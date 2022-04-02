import { TokenPayload } from 'google-auth-library';
import http from 'http';
import { ObjectId, WithId } from 'mongodb';
import { Server } from 'socket.io';
import gapiVerifyToken from '../auth';
import { collections } from '../database';
import { User } from '../database/schema';
import { PrivateChannelChatResponse } from '../routes/chat';
import { FriendResponse } from '../routes/friend';
import { PrivateChannelResponse } from '../routes/privateChannel';
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from './interfaces';

let io: Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let socketSessions = new Map<string, string[]>();
const initializeSocketIO = (server: http.Server) => {
  io = new Server(server, {
    cors: {
      origin: 'http://localhost:3000',
      methods: ['GET'],
    },
  });

  io.use(async (socket, next) => {
    const authToken = socket.handshake.auth.token as string;
    if (!authToken) {
      return next(new Error('Authorization token not found'));
    }

    let decodedToken: TokenPayload | undefined = undefined;
    try {
      decodedToken = await gapiVerifyToken(authToken);
    } catch (e) {
      return next(new Error('Invalid token'));
    }
    if (!decodedToken) {
      return next(new Error('Invalid token'));
    }
    let currentUser: WithId<User> | null = null;
    try {
      currentUser = await collections.users!.findOne({ sub: decodedToken.sub });
    } catch (e) {
      console.log(e);
      return next(new Error('Something went wrong'));
    }

    if (!currentUser) {
      return next(new Error('User forbidden'));
    }

    socket.data.currentUser = currentUser;

    const socketSession = socketSessions.get(currentUser._id.toString());
    if (socketSession) {
      socketSession.push(socket.id);
    } else {
      socketSessions.set(currentUser._id.toString(), [socket.id]);
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected [${socket.id}]`);
    const currentUser = socket.data.currentUser!;

    const activePrivateChannelIds = [
      ...Object.values(currentUser.friends)
        .filter((friend) => {
          if (
            friend.privateChannelId === undefined ||
            friend.active === undefined
          )
            return false;
          return friend.active;
        })
        .map((friend) => friend.privateChannelId!),
      ...currentUser.joinedGroupPrivateChannels,
    ];

    activePrivateChannelIds.forEach((privateChannelId) => {
      socket.join(`privateChannel:${privateChannelId.toString()}`);
    });

    socket.join(`user:${currentUser._id.toString()}`);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected [${socket.id}]`);

      const socketSession = socketSessions.get(currentUser._id.toString());
      if (socketSession) {
        const index = socketSession.indexOf(socket.id);
        if (index >= 0) socketSession.splice(index, 1);
      }
    });
  });
};

const emitSendPrivateChannelChat = (
  privateChannelId: ObjectId,
  payload: PrivateChannelChatResponse
) => {
  io.to(`privateChannel:${privateChannelId.toString()}`).emit(
    'sendPrivateChannelChat',
    payload
  );
};

const emitUpdateFriendshipStatus = (
  userId: ObjectId,
  payload: FriendResponse
) => {
  io.to(`user:${userId.toString()}`).emit('updateFriendshipStatus', payload);
};

const emitNewPrivateChannel = (
  participantIds: ObjectId[],
  payload: WithId<PrivateChannelResponse>
) => {
  io.to(
    participantIds.map((participantId) => `user:${participantId.toString()}`)
  ).emit('newPrivateChannelChat', payload);
  participantIds.forEach((participantId) => {
    const socketSession = socketSessions.get(participantId.toString());
    if (!socketSession) return;
    socketSession.forEach((socketId) => {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) return;
      socket.join(`privateChannel:${payload._id.toString()}`);
    });
  });
};

export {
  initializeSocketIO,
  emitSendPrivateChannelChat,
  emitUpdateFriendshipStatus,
  emitNewPrivateChannel,
};
