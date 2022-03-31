import { WithId } from 'mongodb';
import { User } from '../database/schema';
import { PrivateChannelChatResponse } from '../routes/chat';
import { FriendResponse } from '../routes/friend';
import { PrivateChannelResponse } from '../routes/privateChannel';

interface ServerToClientEvents {
  sendPrivateChannelChat: (payload: PrivateChannelChatResponse) => void;
  updateFriendshipStatus: (payload: FriendResponse) => void;
  newPrivateChannelChat: (payload: WithId<PrivateChannelResponse>) => void;
}

interface ClientToServerEvents {}

interface InterServerEvents {}

interface SocketData {
  authToken: string;
  currentUser: WithId<User>;
}

export {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
};
