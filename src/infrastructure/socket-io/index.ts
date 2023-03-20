import { TokenPayload } from 'google-auth-library';
import http from 'http';
import { WithId } from 'mongodb';
import { Server } from 'socket.io';
import { collections } from '../database';
import { UserModel } from '../database/schema';
import GAPITokenVerifier from '../oauth';
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from './interfaces/socket-io.interface';

let io: Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const initializeSocketIO = (server: http.Server) => {
  io = new Server(server);
  const gapiVerifier = new GAPITokenVerifier();
  io.use(async (socket, next) => {
    const authToken = socket.handshake.auth.token as string;
    if (!authToken) {
      return next(new Error('Authorization token not found'));
    }

    let decodedToken: TokenPayload | undefined = undefined;
    try {
      decodedToken = await gapiVerifier.verifyToken(authToken);
    } catch (e) {
      return next(new Error('Invalid token'));
    }
    if (!decodedToken) {
      return next(new Error('Invalid token'));
    }
    let currentUser: WithId<UserModel> | null = null;
    try {
      currentUser = await collections.users!.findOne({ sub: decodedToken.sub });
    } catch (e) {
      return next(new Error('Something went wrong'));
    }

    if (!currentUser) {
      return next(new Error('User forbidden'));
    }

    socket.data.currentUser = currentUser;
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
    });
  });
};

export { initializeSocketIO, io };
