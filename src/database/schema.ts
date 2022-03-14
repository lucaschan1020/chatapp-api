import { ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
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
  activePrivateChannels: ObjectId[];
  joinedPrivateChannels: ObjectId[];
}

export interface Friend {
  friendId: ObjectId;
  friendshipStatus: FriendshipEnum;
}

export enum FriendshipEnum {
  Pending,
  Requested,
  Friend,
  Blocked,
}

export interface PrivateChannel {
  _id?: ObjectId;
  privateChannelName: string;
  dateCreated: Date;
  isGroup: boolean;
}

export interface ChatBucket {
  _id?: ObjectId;
  channelId: ObjectId;
  startDateTime: Date;
  endDateTime: Date;
  chatMessages: ChatMessage[];
}

export interface ChatMessage {
  timestamp: Date;
  senderId: ObjectId;
  content: string;
}
