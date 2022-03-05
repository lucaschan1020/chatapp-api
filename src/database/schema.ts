import { ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  avatar: string;
  given_name: string;
  family_name: string;
  locale: string;
  username: string;
  discriminator: number;
  register_time: Date;
  friends: Friend[];
}

export interface Friend {
  friend_id: ObjectId;
  friendship_status: FriendshipEnum;
}

export enum FriendshipEnum {
  Pending,
  Requested,
  Friend,
  Blocked,
}
