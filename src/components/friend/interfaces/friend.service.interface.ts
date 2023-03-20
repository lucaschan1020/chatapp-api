import {
  FriendshipEnum,
  UserDto,
} from '../../../infrastructure/database/schema';
import { AppError } from '../../../middleware/interfaces/error-handler.middleware.interface';

type FriendResponse = {
  friendId: string;
  friendshipStatus: FriendshipEnum | null;
  privateChannelId?: string;
  avatar: string;
  username: string;
  discriminator: number;
};

interface IFriendService {
  getAllFriends(user: UserDto): Promise<Record<string, FriendResponse>>;

  getFriend(
    user: UserDto,
    friendInfo: { username: string; discriminator: number }
  ): Promise<FriendResponse>;

  tryAddFriend(
    user: UserDto,
    friendInfo: { username: string; discriminator: number }
  ): Promise<FriendResponse>;

  tryUpdateFriend(
    user: UserDto,
    friendInfo: { username: string; discriminator: number },
    friendshipStatus: FriendshipEnum
  ): Promise<FriendResponse>;

  tryRemoveFriend(
    user: UserDto,
    friendInfo: { username: string; discriminator: number }
  ): Promise<FriendResponse>;

  sendFriendRequest(user: UserDto, friend: UserDto): Promise<FriendResponse>;

  addFriend(user: UserDto, friend: UserDto): Promise<FriendResponse>;

  blockFriend(user: UserDto, friend: UserDto): Promise<FriendResponse>;

  removeFriend(user: UserDto, friend: UserDto): Promise<FriendResponse>;

  throwFriendshipStatusInvalidError(
    userFriendshipStatus: FriendshipEnum | null,
    friendFriendshipStatus: FriendshipEnum | null
  ): AppError;
}

export { FriendResponse };
export default IFriendService;
