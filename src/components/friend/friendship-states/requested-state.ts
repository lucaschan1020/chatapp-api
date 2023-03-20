import {
  FriendshipEnum,
  UserDto,
} from '../../../infrastructure/database/schema';
import IFriendService from '../interfaces/friend.service.interface';
import IFriendshipState from './interfaces/friendship-state.interface';

class RequestedState implements IFriendshipState {
  constructor(private readonly friendService: IFriendService) {}

  tryAdd = async (user: UserDto, friend: UserDto) => {
    const friendFriendship = friend.friends[user.id];

    if (
      !friendFriendship ||
      friendFriendship.friendshipStatus === undefined ||
      friendFriendship.friendshipStatus === null
    ) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.REQUESTED,
        null
      );
    }

    if (friendFriendship.friendshipStatus === FriendshipEnum.PENDING) {
      return await this.friendService.addFriend(user, friend);
    }

    if (friendFriendship.friendshipStatus === FriendshipEnum.REQUESTED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.REQUESTED,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.FRIEND) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.REQUESTED,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.BLOCKED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.REQUESTED,
        friendFriendship.friendshipStatus
      );
    }

    throw this.friendService.throwFriendshipStatusInvalidError(
      FriendshipEnum.REQUESTED,
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
        FriendshipEnum.REQUESTED,
        null
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.PENDING) {
      return await this.friendService.blockFriend(user, friend);
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.REQUESTED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.REQUESTED,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.FRIEND) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.REQUESTED,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.BLOCKED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.REQUESTED,
        friendFriendship.friendshipStatus
      );
    }

    throw this.friendService.throwFriendshipStatusInvalidError(
      FriendshipEnum.REQUESTED,
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
        FriendshipEnum.REQUESTED,
        null
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.PENDING) {
      return await this.friendService.removeFriend(user, friend);
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.REQUESTED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.REQUESTED,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.FRIEND) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.REQUESTED,
        friendFriendship.friendshipStatus
      );
    }
    if (friendFriendship.friendshipStatus === FriendshipEnum.BLOCKED) {
      throw this.friendService.throwFriendshipStatusInvalidError(
        FriendshipEnum.REQUESTED,
        friendFriendship.friendshipStatus
      );
    }

    throw this.friendService.throwFriendshipStatusInvalidError(
      FriendshipEnum.REQUESTED,
      friendFriendship.friendshipStatus
    );
  };
}

export default RequestedState;
