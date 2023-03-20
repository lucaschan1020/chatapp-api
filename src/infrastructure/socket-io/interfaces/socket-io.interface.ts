import { WithId } from 'mongodb';
import { ChatBucketResponse } from '../../../components/chat/interfaces/chat.service.interface';
import { FriendResponse } from '../../../components/friend/interfaces/friend.service.interface';
import { PrivateChannelResponse } from '../../../components/private-channel/interfaces/private-channel.service.interface';
import { UserModel } from '../../database/schema';

interface ServerToClientEvents {
  sendPrivateChannelChat: (payload: ChatBucketResponse) => void;
  updateFriendshipStatus: (payload: FriendResponse) => void;
  newPrivateChannelChat: (payload: PrivateChannelResponse) => void;
}

interface ClientToServerEvents {}

interface InterServerEvents {}

interface SocketData {
  authToken: string;
  currentUser: WithId<UserModel>;
}

export {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
};
