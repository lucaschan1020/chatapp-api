import {
  FriendshipEnum,
  UserDto,
} from '../../../../infrastructure/database/schema';
import { FriendResponse } from '../../interfaces/friend.service.interface';

interface IFriendshipState {
  tryAdd(user: UserDto, friend: UserDto): Promise<FriendResponse>;
  tryBlock(user: UserDto, friend: UserDto): Promise<FriendResponse>;
  tryRemove(user: UserDto, friend: UserDto): Promise<FriendResponse>;
}

export default IFriendshipState;
