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

class FriendState implements IFriendshipState {
  constructor(private readonly friendService: IFriendService) {}

  tryAdd = async (user: UserDto, friend: UserDto) => {
    const friendFriendship = friend.friends[user.id];
    if (
      !friendFriendship ||
      friendFriendship.friendshipStatus === undefined ||
      friendFriendship.friendshipStatus === null
    ) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.FRIEND,
        null
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.PENDING) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.FRIEND,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.REQUESTED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.FRIEND,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.FRIEND) {
      throw new AppError(ErrorType.VALIDATION_ERROR, 'Already friends');
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.BLOCKED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.FRIEND,
        friendFriendship.friendshipStatus
      );
    }

    throw this.friendService.throwFriendshipStatusInvalidError(
      FriendshipEnum.FRIEND,
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
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.FRIEND,
        null
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.PENDING) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.FRIEND,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.REQUESTED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.FRIEND,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.FRIEND) {
      return await this.friendService.blockFriend(user, friend);
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.BLOCKED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.FRIEND,
        friendFriendship.friendshipStatus
      );
    }

    throw this.friendService.throwFriendshipStatusInvalidError(
      FriendshipEnum.FRIEND,
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
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.FRIEND,
        null
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.PENDING) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.FRIEND,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.REQUESTED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.FRIEND,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.FRIEND) {
      return await this.friendService.removeFriend(user, friend);
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.BLOCKED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.FRIEND,
        friendFriendship.friendshipStatus
      );
    }

    throw this.friendService.throwFriendshipStatusInvalidError(
      FriendshipEnum.FRIEND,
      friendFriendship.friendshipStatus
    );
  };
}

export default FriendState;
