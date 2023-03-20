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

class NullState implements IFriendshipState {
  constructor(private readonly friendService: IFriendService) {}

  tryAdd = async (user: UserDto, friend: UserDto) => {
    const friendFriendship = friend.friends[user.id];

    if (
      !friendFriendship ||
      friendFriendship.friendshipStatus === undefined ||
      friendFriendship.friendshipStatus === null
    ) {
      return await this.friendService.sendFriendRequest(user, friend);
    }

    if (friendFriendship.friendshipStatus === FriendshipEnum.PENDING) {
      return await this.friendService.addFriend(user, friend);
    }

    if (friendFriendship.friendshipStatus === FriendshipEnum.REQUESTED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        null,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.FRIEND) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        null,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.BLOCKED) {
      throw new AppError(
        ErrorType.AUTHORIZATION_ERROR,
        'Failed to update friendship'
      );
    }

    throw this.friendService.throwFriendshipStatusInvalidError(
      null,
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
      return await this.friendService.blockFriend(user, friend);
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.REQUESTED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        null,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.FRIEND) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        null,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.BLOCKED) {
      return await this.friendService.blockFriend(user, friend);
    }

    throw this.friendService.throwFriendshipStatusInvalidError(
      null,
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
      throw new AppError(ErrorType.VALIDATION_ERROR, 'Nothing to remove');
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.PENDING) {
      throw new AppError(ErrorType.VALIDATION_ERROR, 'Nothing to remove');
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.REQUESTED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        null,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.FRIEND) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        null,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.BLOCKED) {
      throw new AppError(ErrorType.VALIDATION_ERROR, 'Nothing to remove');
    }

    throw this.friendService.throwFriendshipStatusInvalidError(
      null,
      friendFriendship.friendshipStatus
    );
  };
}

export default NullState;
