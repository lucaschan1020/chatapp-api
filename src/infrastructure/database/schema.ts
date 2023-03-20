import { ObjectId, WithId } from 'mongodb';

interface UserModel {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatar: string;
  givenName: string;
  familyName: string;
  locale: string;
  username: string;
  discriminator: number;
  registerTime: Date;
  friends: FriendModel[];
  joinedGroupPrivateChannels: ObjectId[];
}

interface UserDto {
  id: string;
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatar: string;
  givenName: string;
  familyName: string;
  locale: string;
  username: string;
  discriminator: number;
  registerTime: Date;
  friends: Record<string, FriendDto>;
  joinedGroupPrivateChannels: string[];
}

interface FriendModel {
  friendId: ObjectId;
  friendshipStatus?: FriendshipEnum | null;
  privateChannelId?: ObjectId;
  active?: boolean;
}

type FriendDto = {
  friendId: string;
  friendshipStatus?: FriendshipEnum | null;
  privateChannelId?: string;
  active?: boolean;
};

enum FriendshipEnum {
  // user is the one who sent the friend request
  PENDING = 'PENDING',
  // user is the one who received the friend request
  REQUESTED = 'REQUESTED',
  // both users are friends
  FRIEND = 'FRIEND',
  // user is the one who blocked the other user
  BLOCKED = 'BLOCKED',
}

interface PrivateChannelModel {
  privateChannelName: string;
  dateCreated: Date;
  isGroup: boolean;
}

interface PrivateChannelDto {
  id: string;
  privateChannelName: string;
  dateCreated: Date;
  isGroup: boolean;
}

interface ChatBucket {
  channelId: ObjectId;
  startDateTime: Date;
  endDateTime: Date;
  chatMessages: WithId<ChatMessage>[];
  bucketId: number;
}

interface ChatBucketDto {
  id: string;
  channelId: string;
  startDateTime: Date;
  endDateTime: Date;
  chatMessages: ChatMessageDto[];
  bucketId: number;
}

interface ChatMessage {
  timestamp: Date;
  senderId: ObjectId;
  content: string | null;
  lastModified: Date;
}

interface ChatMessageDto {
  id: string;
  timestamp: Date;
  senderId: string;
  content: string | null;
  lastModified: Date;
}

export {
  UserModel,
  UserDto,
  FriendModel,
  FriendDto,
  FriendshipEnum,
  PrivateChannelModel,
  PrivateChannelDto,
  ChatBucket,
  ChatBucketDto,
  ChatMessage,
  ChatMessageDto,
};
