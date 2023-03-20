import {
  FriendDto,
  FriendshipEnum,
  PrivateChannelDto,
  UserDto,
} from '../../infrastructure/database/schema';
import {
  AppError,
  ErrorType,
} from '../../middleware/interfaces/error-handler.middleware.interface';
import { objectMap } from '../../utilities/object-utility';
import {
  transformFriendResponse,
  transformPrivateChannelResponse,
} from '../../utilities/transform';
import IPrivateChannelNotification from '../private-channel/interfaces/private-channel.notification.interface';
import IPrivateChannelRepository from '../private-channel/interfaces/private-channel.repository.interface';
import IUserRepository from '../user/interfaces/user.repository.interface';
import BlockedState from './friendship-states/blocked-state';
import FriendState from './friendship-states/friend-state';
import IFriendshipState from './friendship-states/interfaces/friendship-state.interface';
import NullState from './friendship-states/null-state';
import PendingState from './friendship-states/pending-state';
import RequestedState from './friendship-states/requested-state';
import IFriendNotification from './interfaces/friend.notification.interface';
import IFriendService from './interfaces/friend.service.interface';
import IFriendValidator from './interfaces/friend.validator.interface';

class FriendService implements IFriendService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly privateChannelRepository: IPrivateChannelRepository,
    private readonly friendNotification: IFriendNotification,
    private readonly privateChannelNotification: IPrivateChannelNotification,
    private readonly friendValidator: IFriendValidator
  ) {}

  getAllFriends = async (user: UserDto) => {
    const friends = await this.userRepository.findMany(
      Object.keys(user.friends)
    );

    const userFriendshipsResponse = objectMap(friends, (friend) =>
      transformFriendResponse(user.friends[friend.id], friend)
    );

    return userFriendshipsResponse;
  };

  getFriend = async (
    user: UserDto,
    friendInfo: { username: string; discriminator: number }
  ) => {
    await this.friendValidator.validateFriendInfo(friendInfo);
    const { username, discriminator } = friendInfo;

    if (username === user.username && discriminator === user.discriminator) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'Username and discriminator must be other user'
      );
    }

    const friend = await this.userRepository.findOne({
      username,
      discriminator,
    });
    if (!friend) {
      throw new AppError(ErrorType.NOT_FOUND_ERROR, 'User not found');
    }

    const userFriendship = user.friends[friend.id];

    return transformFriendResponse(userFriendship, friend);
  };

  tryAddFriend = async (
    user: UserDto,
    friendInfo: { username: string; discriminator: number }
  ) => {
    await this.friendValidator.validateFriendInfo(friendInfo);
    const { username, discriminator } = friendInfo;

    if (username === user.username && discriminator === user.discriminator) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'Username and discriminator must be other user'
      );
    }

    const friend = await this.userRepository.findOne({
      username,
      discriminator,
    });
    if (!friend) {
      throw new AppError(ErrorType.NOT_FOUND_ERROR, 'User not found');
    }

    const userFriendshipState: IFriendshipState = this.getFriendshipState(
      user.friends[friend.id]
    );

    const userFriendshipResponse = await userFriendshipState.tryAdd(
      user,
      friend
    );

    return userFriendshipResponse;
  };

  tryUpdateFriend = async (
    user: UserDto,
    friendInfo: { username: string; discriminator: number },
    nextFriendshipStatus: FriendshipEnum
  ) => {
    await this.friendValidator.validateFriendInfo(friendInfo);
    await this.friendValidator.validateFriendshipStatus(nextFriendshipStatus);
    const { username, discriminator } = friendInfo;

    if (username === user.username && discriminator === user.discriminator) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'Username and discriminator must be other user'
      );
    }

    if (
      nextFriendshipStatus !== FriendshipEnum.FRIEND &&
      nextFriendshipStatus !== FriendshipEnum.BLOCKED
    ) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'This method only supports Friend and Blocked'
      );
    }

    const friend = await this.userRepository.findOne({
      username,
      discriminator,
    });
    if (!friend) {
      throw new AppError(ErrorType.NOT_FOUND_ERROR, 'User not found');
    }

    const userFriendshipState: IFriendshipState = this.getFriendshipState(
      user.friends[friend.id]
    );

    if (nextFriendshipStatus === FriendshipEnum.FRIEND) {
      const userFriendshipResponse = await userFriendshipState.tryAdd(
        user,
        friend
      );

      return userFriendshipResponse;
    }

    if (nextFriendshipStatus === FriendshipEnum.BLOCKED) {
      const userFriendshipResponse = await userFriendshipState.tryBlock(
        user,
        friend
      );

      return userFriendshipResponse;
    }

    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'This method only supports Friend and Blocked'
    );
  };

  tryRemoveFriend = async (
    user: UserDto,
    friendInfo: { username: string; discriminator: number }
  ) => {
    await this.friendValidator.validateFriendInfo(friendInfo);
    const { username, discriminator } = friendInfo;

    if (username === user.username && discriminator === user.discriminator) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'Username and discriminator must be other user'
      );
    }

    const friend = await this.userRepository.findOne({
      username,
      discriminator,
    });
    if (!friend) {
      throw new AppError(ErrorType.NOT_FOUND_ERROR, 'User not found');
    }

    const userFriendshipState: IFriendshipState = this.getFriendshipState(
      user.friends[friend.id]
    );

    const userFriendshipResponse = await userFriendshipState.tryRemove(
      user,
      friend
    );

    return userFriendshipResponse;
  };

  sendFriendRequest = async (user: UserDto, friend: UserDto) => {
    const updatedFriendFriendship = await this.userRepository.updateFriend(
      friend.id,
      user.id,
      {
        friendshipStatus: FriendshipEnum.REQUESTED,
      }
    );

    const updatedUserFriendship = await this.userRepository.updateFriend(
      user.id,
      friend.id,
      {
        friendshipStatus: FriendshipEnum.PENDING,
      }
    );

    const friendFriendshipResponse = transformFriendResponse(
      updatedFriendFriendship,
      user
    );

    const userFriendshipResponse = transformFriendResponse(
      updatedUserFriendship,
      friend
    );

    this.friendNotification.notifyFriendStatus(
      friend.id,
      friendFriendshipResponse
    );

    return userFriendshipResponse;
  };

  addFriend = async (user: UserDto, friend: UserDto) => {
    const userFriendship = user.friends[friend.id];
    const friendFriendship = friend.friends[user.id];
    let newPrivateChannelDto: PrivateChannelDto | null = null;
    const createdDate = new Date();

    // if either one of the friendship does not have a private channel, create one
    if (
      !userFriendship.privateChannelId ||
      !friendFriendship.privateChannelId
    ) {
      newPrivateChannelDto = await this.privateChannelRepository.insert({
        privateChannelName: '',
        dateCreated: createdDate,
        isGroup: false,
      });
    }

    const updatedFriendFriendship = await this.userRepository.updateFriend(
      friend.id,
      user.id,
      {
        friendshipStatus: FriendshipEnum.FRIEND,
        privateChannelId:
          newPrivateChannelDto !== null ? newPrivateChannelDto.id : undefined,
        active: true,
      }
    );

    const updatedUserFriendship = await this.userRepository.updateFriend(
      user.id,
      friend.id,
      {
        friendshipStatus: FriendshipEnum.FRIEND,
        privateChannelId:
          newPrivateChannelDto !== null ? newPrivateChannelDto.id : undefined,
        active: true,
      }
    );

    if (newPrivateChannelDto !== null) {
      const friendPrivateChannelResponse = transformPrivateChannelResponse(
        newPrivateChannelDto,
        {
          [user.id]: user,
        }
      );

      const userPrivateChannelResponse = transformPrivateChannelResponse(
        newPrivateChannelDto,
        {
          [friend.id]: friend,
        }
      );

      this.privateChannelNotification.notifyNewPrivateChannel(
        [friend.id],
        friendPrivateChannelResponse
      );

      this.privateChannelNotification.subscribe(
        [friend.id],
        newPrivateChannelDto.id
      );

      // Notify self
      this.privateChannelNotification.notifyNewPrivateChannel(
        [user.id],
        userPrivateChannelResponse
      );

      this.privateChannelNotification.subscribe(
        [user.id],
        newPrivateChannelDto.id
      );
    }

    const friendFriendshipResponse = transformFriendResponse(
      updatedFriendFriendship,
      user
    );

    const userFriendshipResponse = transformFriendResponse(
      updatedUserFriendship,
      friend
    );

    this.friendNotification.notifyFriendStatus(
      friend.id,
      friendFriendshipResponse
    );

    return userFriendshipResponse;
  };

  blockFriend = async (user: UserDto, friend: UserDto) => {
    const friendFriendship = friend.friends[user.id];
    let updatedFriendFriendship: FriendDto | null = null;

    // if the friend already blocked the user, do not update
    if (
      friendFriendship?.friendshipStatus !== null &&
      friendFriendship?.friendshipStatus !== FriendshipEnum.BLOCKED
    ) {
      updatedFriendFriendship = await this.userRepository.updateFriend(
        friend.id,
        user.id,
        {
          friendshipStatus: null,
        }
      );
    }

    const updatedUserFriendship = await this.userRepository.updateFriend(
      user.id,
      friend.id,
      {
        friendshipStatus: FriendshipEnum.BLOCKED,
      }
    );

    if (updatedFriendFriendship !== null) {
      const friendFriendshipResponse = transformFriendResponse(
        updatedFriendFriendship,
        user
      );

      this.friendNotification.notifyFriendStatus(
        friend.id,
        friendFriendshipResponse
      );
    }

    return transformFriendResponse(updatedUserFriendship, friend);
  };

  removeFriend = async (user: UserDto, friend: UserDto) => {
    const friendFriendship = friend.friends[user.id];
    let updatedFriendFriendship: FriendDto | null = null;

    if (
      friendFriendship?.friendshipStatus === FriendshipEnum.FRIEND ||
      friendFriendship?.friendshipStatus === FriendshipEnum.REQUESTED
    ) {
      updatedFriendFriendship = await this.userRepository.updateFriend(
        friend.id,
        user.id,
        {
          friendshipStatus: null,
        }
      );
    }

    const updatedUserFriendship = await this.userRepository.updateFriend(
      user.id,
      friend.id,
      {
        friendshipStatus: null,
      }
    );

    if (updatedFriendFriendship !== null) {
      const friendFriendshipResponse = transformFriendResponse(
        updatedFriendFriendship,
        user
      );

      this.friendNotification.notifyFriendStatus(
        friend.id,
        friendFriendshipResponse
      );
    }

    return transformFriendResponse(updatedUserFriendship, friend);
  };

  throwFriendshipStatusInvalidError = (
    userFriendshipStatus: FriendshipEnum | null,
    friendFriendshipStatus: FriendshipEnum | null
  ) => {
    return new AppError(
      ErrorType.INTERNAL_SERVER_ERROR,
      'Something went wrong',
      undefined,
      {
        message: 'Friendship status is in an invalid state',
        userFriendshipStatus,
        friendFriendshipStatus,
      }
    );
  };

  private getFriendshipState = (friend: FriendDto): IFriendshipState => {
    if (
      !friend ||
      friend.friendshipStatus === undefined ||
      friend.friendshipStatus === null
    ) {
      return new NullState(this);
    }
    if (friend.friendshipStatus === FriendshipEnum.PENDING) {
      return new PendingState(this);
    }
    if (friend.friendshipStatus === FriendshipEnum.REQUESTED) {
      return new RequestedState(this);
    }
    if (friend.friendshipStatus === FriendshipEnum.FRIEND) {
      return new FriendState(this);
    }
    if (friend.friendshipStatus === FriendshipEnum.BLOCKED) {
      return new BlockedState(this);
    }
    throw this.throwFriendshipStatusInvalidError(friend.friendshipStatus, null);
  };
}

export default FriendService;
