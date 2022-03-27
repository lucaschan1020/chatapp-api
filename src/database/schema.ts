import { ObjectId } from 'mongodb';

export interface User {
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

export interface Friend {
  friendId: ObjectId;
  friendshipStatus?: FriendshipEnum;
  privateChannelId: ObjectId;
  active: boolean;
}

export enum FriendshipEnum {
  Pending,
  Requested,
  Friend,
  Blocked,
}

export interface PrivateChannel {
  privateChannelName: string;
  dateCreated: Date;
  isGroup: boolean;
}

export interface ChatBucket {
  channelId: ObjectId;
  startDateTime: Date;
  endDateTime: Date;
  chatMessages: ChatMessage[];
  bucketId: number;
}

export interface ChatMessage {
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
