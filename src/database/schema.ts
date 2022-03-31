import { ObjectId } from 'mongodb';

interface User {
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
  // activePrivateChannels: ObjectId[];
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
  chatMessages: ChatMessage[];
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
  User,
  Friend,
  FriendshipEnum,
  PrivateChannel,
  ChatBucket,
  ChatMessage,
};
