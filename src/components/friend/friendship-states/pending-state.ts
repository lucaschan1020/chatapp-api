import {
  FriendshipEnum,
  UserDto,
} from '../../../infrastructure/database/schema';
import {
  AppError,
  ErrorType,
} from '../../../middleware/interfaces/error-handler.middleware.interface';
import IFriendService from '../interfaces/friend.service.interface';
import IFriendshipState from './interfaces/friendship-state.interface';

class PendingState implements IFriendshipState {
  constructor(private readonly friendService: IFriendService) {}

  tryAdd = async (user: UserDto, friend: UserDto) => {
    const friendFriendship = friend.friends[user.id];

    if (
      !friendFriendship ||
      friendFriendship.friendshipStatus === undefined ||
      friendFriendship.friendshipStatus === null
    ) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'Already sent friend request'
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.PENDING) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.PENDING,
        friendFriendship.friendshipStatus
      );
    }

    if (friendFriendship.friendshipStatus === FriendshipEnum.REQUESTED) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'Already sent friend request'
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.FRIEND) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.PENDING,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.BLOCKED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.PENDING,
        friendFriendship.friendshipStatus
      );
    }

    throw this.friendService.throwFriendshipStatusInvalidError(
      FriendshipEnum.PENDING,
      friendFriendship.friendshipStatus
    );
  };

  tryBlock = async (user: UserDto, friend: UserDto) => {
    const friendFriendship = friend.friends[user.id];

    if (
      !friendFriendship ||
      friendFriendship.friendshipStatus === undefined ||
      friendFriendship.friendshipStatus === null
    ) {
      return await this.friendService.blockFriend(user, friend);
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.PENDING) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.PENDING,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.REQUESTED) {
      return await this.friendService.blockFriend(user, friend);
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.FRIEND) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.PENDING,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.BLOCKED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.PENDING,
        friendFriendship.friendshipStatus
      );
    }

    throw this.friendService.throwFriendshipStatusInvalidError(
      FriendshipEnum.PENDING,
      friendFriendship.friendshipStatus
    );
  };

  tryRemove = async (user: UserDto, friend: UserDto) => {
    const friendFriendship = friend.friends[user.id];

    if (
      !friendFriendship ||
      friendFriendship.friendshipStatus === undefined ||
      friendFriendship.friendshipStatus === null
    ) {
      return await this.friendService.removeFriend(user, friend);
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.PENDING) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.PENDING,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.REQUESTED) {
      return await this.friendService.removeFriend(user, friend);
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.FRIEND) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.PENDING,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.BLOCKED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.PENDING,
        friendFriendship.friendshipStatus
      );
    }

    throw this.friendService.throwFriendshipStatusInvalidError(
      FriendshipEnum.PENDING,
      friendFriendship.friendshipStatus
    );
  };
}

export default PendingState;
