import {
  ChatBucketDto,
  ChatMessageDto,
  FriendshipEnum,
  UserDto,
} from '../../infrastructure/database/schema';
import {
  AppError,
  ErrorType,
} from '../../middleware/interfaces/error-handler.middleware.interface';
import { transformChatBucketResponse } from '../../utilities/transform';
import IPrivateChannelRepository from '../private-channel/interfaces/private-channel.repository.interface';
import IChatNotification from './interfaces/chat.notification.interface';
import IChatRepository from './interfaces/chat.repository.interface';
import IChatService from './interfaces/chat.service.interface';
import IChatValidator from './interfaces/chat.validator.interface';

class ChatService implements IChatService {
  constructor(
    private readonly chatRepository: IChatRepository,
    private readonly privateChannelRepository: IPrivateChannelRepository,
    private readonly chatNotification: IChatNotification,
    private readonly chatValidator: IChatValidator
  ) {}
  getChatBucket = async (
    user: UserDto,
    chatBucketInfo: { channelId: string; bucketId: number }
  ) => {
    await this.chatValidator.validateChatBucketInfo(chatBucketInfo);
    const { channelId, bucketId } = chatBucketInfo;

    const privateChannel = await this.privateChannelRepository.findOne({
      id: channelId,
    });

    if (!privateChannel) {
      throw new AppError(ErrorType.NOT_FOUND_ERROR, 'Channel not found');
    }

    const isJoined = privateChannel.isGroup
      ? user.joinedGroupPrivateChannels.includes(channelId)
      : Object.values(user.friends).some(
          (friend) => friend.privateChannelId === channelId
        );

    if (!isJoined) {
      throw new AppError(
        ErrorType.AUTHORIZATION_ERROR,
        'User is not participant of channel'
      );
    }

    const chatBucket = await this.chatRepository.findOne({
      channelId: channelId,
      bucketId,
    });

    if (!chatBucket) {
      throw new AppError(ErrorType.NOT_FOUND_ERROR, 'Chat bucket not found');
    }

    return transformChatBucketResponse(chatBucket);
  };

  getLatestChatBucket = async (user: UserDto, channelId: string) => {
    await this.chatValidator.validateChannelId(channelId);
    const privateChannel = await this.privateChannelRepository.findOne({
      id: channelId,
    });

    if (!privateChannel) {
      throw new AppError(ErrorType.NOT_FOUND_ERROR, 'Channel not found');
    }

    const isJoined = privateChannel.isGroup
      ? user.joinedGroupPrivateChannels.includes(channelId)
      : Object.values(user.friends).some(
          (friend) => friend.privateChannelId === channelId
        );

    if (!isJoined) {
      throw new AppError(
        ErrorType.AUTHORIZATION_ERROR,
        'User is not participant of channel'
      );
    }

    let chatBucket: ChatBucketDto | null = null;
    chatBucket = await this.chatRepository.findLatestChatBucket(channelId);

    if (!chatBucket) {
      chatBucket = await this.chatRepository.insert({
        channelId: channelId,
        startDateTime: new Date(),
        endDateTime: new Date(),
        bucketId: 0,
        chatMessages: [],
      });
    }

    return transformChatBucketResponse(chatBucket);
  };

  insertMessage = async (user: UserDto, channelId: string, content: string) => {
    await this.chatValidator.validateChannelId(channelId);
    await this.chatValidator.validateChatContent(content);

    content = content.trim();
    const now = new Date();

    const privateChannel = await this.privateChannelRepository.findOne({
      id: channelId,
    });

    if (!privateChannel) {
      throw new AppError(ErrorType.NOT_FOUND_ERROR, 'Channel not found');
    }

    if (!privateChannel.isGroup) {
      const friend = Object.values(user.friends).find(
        (friend) => friend.privateChannelId === channelId
      );
      if (!friend) {
        throw new AppError(
          ErrorType.AUTHORIZATION_ERROR,
          'User is not participant of channel'
        );
      }

      if (friend.friendshipStatus !== FriendshipEnum.FRIEND) {
        throw new AppError(
          ErrorType.AUTHORIZATION_ERROR,
          'User is not friend with this friend'
        );
      }
    } else {
      if (!user.joinedGroupPrivateChannels.includes(channelId)) {
        throw new AppError(
          ErrorType.AUTHORIZATION_ERROR,
          'User is not participant of channel'
        );
      }
    }

    let chatBucket: ChatBucketDto | null = null;
    const newChatMessage = {
      timestamp: now,
      senderId: user.id,
      content,
      lastModified: now,
    };

    let chatMessage: ChatMessageDto | null = null;
    chatBucket = await this.chatRepository.findLatestChatBucket(channelId);

    if (!chatBucket) {
      chatBucket = await this.chatRepository.insert({
        channelId: channelId,
        startDateTime: now,
        endDateTime: now,
        bucketId: 0,
        chatMessages: [newChatMessage],
      });

      chatMessage = chatBucket.chatMessages.at(-1)!;
    } else if (chatBucket.chatMessages.length >= 50) {
      // need to fix race condition
      chatBucket = await this.chatRepository.insert({
        channelId: channelId,
        startDateTime: now,
        endDateTime: now,
        bucketId: chatBucket.bucketId + 1,
        chatMessages: [newChatMessage],
      });

      chatMessage = chatBucket.chatMessages.at(-1)!;
    } else {
      chatMessage = await this.chatRepository.pushChatMessage(
        chatBucket.id,
        newChatMessage,
        now
      );
    }

    const chatBucketResponse = transformChatBucketResponse({
      ...chatBucket,
      chatMessages: [chatMessage],
    });

    this.chatNotification.notifyNewChat(channelId, chatBucketResponse, user.id);

    return chatBucketResponse;
  };
}

export default ChatService;
