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
  friends: Friend[];
  joinedGroupPrivateChannels: ObjectId[];
}

interface UserDTO {
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
  friends: Record<string, Friend>;
  joinedGroupPrivateChannels: ObjectId[];
}

interface Friend {
  friendId: ObjectId;
  friendshipStatus?: FriendshipEnum | null;
  privateChannelId?: ObjectId;
  active?: boolean;
}

enum FriendshipEnum {
  Pending,
  Requested,
  Friend,
  Blocked,
}

interface PrivateChannel {
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

interface ChatMessage {
  timestamp: Date;
  senderId: ObjectId;
  // previousContent: PreviousChatMessageContent[];
  content: string | null;
  lastModified: Date;
}

// export interface PreviousChatMessageContent {
//   timestamp: Date;
//   content: string;
// }

export {
  UserModel,
  UserDTO,
  Friend,
  FriendshipEnum,
  PrivateChannel,
  ChatBucket,
  ChatMessage,
};
