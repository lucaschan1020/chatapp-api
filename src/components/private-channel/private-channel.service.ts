import {
  FriendDto,
  FriendshipEnum,
  UserDto,
} from '../../infrastructure/database/schema';
import {
  AppError,
  ErrorType,
} from '../../middleware/interfaces/error-handler.middleware.interface';
import { objectFilter, objectMap } from '../../utilities/object-utility';
import {
  transformFriendResponse,
  transformPrivateChannelResponse,
} from '../../utilities/transform';
import IFriendNotification from '../friend/interfaces/friend.notification.interface';
import IUserRepository from '../user/interfaces/user.repository.interface';
import IPrivateChannelNotification from './interfaces/private-channel.notification.interface';
import IPrivateChannelRepository from './interfaces/private-channel.repository.interface';
import IPrivateChannelService from './interfaces/private-channel.service.interface';
import IPrivateChannelValidator from './interfaces/private-channel.validator.interface';

class PrivateChannelService implements IPrivateChannelService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly privateChannelRepository: IPrivateChannelRepository,
    private readonly friendNotification: IFriendNotification,
    private readonly privateChannelNotification: IPrivateChannelNotification,
    private readonly privateChannelValidator: IPrivateChannelValidator
  ) {}

  getPrivateChannel = async (user: UserDto, privateChannelId: string) => {
    await this.privateChannelValidator.validatePrivateChannelId(
      privateChannelId
    );

    const privateChannel = await this.privateChannelRepository.findOne({
      id: privateChannelId,
    });

    if (!privateChannel) {
      throw new AppError(
        ErrorType.NOT_FOUND_ERROR,
        'Private channel not found'
      );
    }

    const isJoined = privateChannel.isGroup
      ? user.joinedGroupPrivateChannels.includes(privateChannel.id)
      : Object.values(user.friends).some(
          (friend) => friend.privateChannelId === privateChannel.id
        );

    if (!isJoined) {
      throw new AppError(
        ErrorType.AUTHORIZATION_ERROR,
        'User is not joined to this private channel'
      );
    }

    let participantsDto = {} as Record<string, UserDto>;
    if (!privateChannel.isGroup) {
      const friend = Object.values(user.friends).find(
        (friend) => friend.privateChannelId === privateChannel.id
      );
      participantsDto = await this.userRepository.findMany([friend!.friendId]);
    } else {
      participantsDto = await this.userRepository.findParticipants([
        privateChannel.id,
      ]);
    }

    // remove self from participants info
    delete participantsDto[user.id];

    return transformPrivateChannelResponse(privateChannel, participantsDto);
  };

  getAllPrivateChannels = async (user: UserDto) => {
    const activePrivateChannels = Object.values(user.friends).filter(
      (friend) => {
        if (
          friend.privateChannelId === undefined ||
          friend.active === undefined
        )
          return false;
        return friend.active;
      }
    );

    const privateChannelIds = [
      ...user.joinedGroupPrivateChannels,
      ...activePrivateChannels.map((friend) => friend.privateChannelId!),
    ];

    const privateChannels = await this.privateChannelRepository.findAll(
      privateChannelIds
    );

    const friends = await this.userRepository.findMany(
      activePrivateChannels.map((privateChannel) => privateChannel.friendId)
    );

    const groupParticipants = await this.userRepository.findParticipants(
      user.joinedGroupPrivateChannels
    );

    return objectMap(privateChannels, (privateChannel) =>
      privateChannel.isGroup
        ? transformPrivateChannelResponse(
            privateChannel,
            objectFilter(groupParticipants, (participant) =>
              participant.joinedGroupPrivateChannels.includes(privateChannel.id)
            )
          )
        : transformPrivateChannelResponse(
            privateChannel,
            objectFilter(
              friends,
              (friend) =>
                user.friends[friend.id].privateChannelId === privateChannel.id
            )
          )
    );
  };

  createPrivateChannel = async (
    user: UserDto,
    privateChannelInfo: { participants: string[]; privateChannelName: string }
  ) => {
    await this.privateChannelValidator.validatePrivateChannelInfo(
      privateChannelInfo
    );
    const { participants, privateChannelName } = privateChannelInfo;

    const isContainsSelf = participants.includes(user.id);
    if (isContainsSelf) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'Participants cannot contain user himself or herself'
      );
    }

    const isGroup = participants.length > 1;
    const notFriends = participants.filter((participant) => {
      if (user.friends[participant] === undefined) return true;
      return (
        user.friends[participant].friendshipStatus !== FriendshipEnum.FRIEND
      );
    });

    if (isGroup && notFriends.length > 0) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'One or more participants is not friend'
      );
    }

    if (
      !isGroup &&
      user.friends[participants[0]]?.privateChannelId !== undefined
    ) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'Private channel with this friend already exist'
      );
    }

    if (
      !isGroup &&
      user.friends[participants[0]]?.friendshipStatus === FriendshipEnum.BLOCKED
    ) {
      throw new AppError(
        ErrorType.AUTHORIZATION_ERROR,
        'Cannot create private channel with blocked friend'
      );
    }

    const participantsInfo = await this.userRepository.findMany(participants);
    if (participants.length !== Object.keys(participantsInfo).length) {
      throw new AppError(
        ErrorType.NOT_FOUND_ERROR,
        'One or more participants not found'
      );
    }

    const newPrivateChannel = await this.privateChannelRepository.insert({
      privateChannelName,
      isGroup,
      dateCreated: new Date(),
    });

    let updatedFriendFriendship: FriendDto | null = null;
    let updatedUserFriendship: FriendDto | null = null;
    if (!isGroup) {
      updatedFriendFriendship = await this.userRepository.updateFriend(
        participants[0],
        user.id,
        {
          privateChannelId: newPrivateChannel.id,
          active: true,
        }
      );

      updatedUserFriendship = await this.userRepository.updateFriend(
        user.id,
        participants[0],
        {
          privateChannelId: newPrivateChannel.id,
          active: true,
        }
      );
    } else {
      this.userRepository.insertGroupPrivateChannel(
        [user.id, ...participants],
        newPrivateChannel.id
      );
    }

    participants.forEach((receiver) => {
      this.privateChannelNotification.notifyNewPrivateChannel(
        [receiver],
        transformPrivateChannelResponse(newPrivateChannel, {
          ...objectFilter(
            participantsInfo,
            (participant) => participant.id !== receiver
          ),
          [user.id]: user,
        })
      );

      this.privateChannelNotification.subscribe(
        [receiver],
        newPrivateChannel.id
      );
    });

    if (updatedFriendFriendship && updatedUserFriendship) {
      this.friendNotification.notifyFriendStatus(
        participants[0],
        transformFriendResponse(updatedFriendFriendship, user)
      );

      // Notify self
      this.friendNotification.notifyFriendStatus(
        user.id,
        transformFriendResponse(
          updatedUserFriendship,
          participantsInfo[participants[0]]
        )
      );
    }

    this.privateChannelNotification.subscribe([user.id], newPrivateChannel.id);

    return transformPrivateChannelResponse(newPrivateChannel, participantsInfo);
  };
}

export default PrivateChannelService;
