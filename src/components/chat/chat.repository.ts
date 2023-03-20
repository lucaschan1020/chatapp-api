import { Filter, ObjectId, WithId } from 'mongodb';
import { collections } from '../../infrastructure/database';
import {
  ChatBucket,
  ChatBucketDto,
  ChatMessage,
  ChatMessageDto,
} from '../../infrastructure/database/schema';
import {
  AppError,
  ErrorType,
} from '../../middleware/interfaces/error-handler.middleware.interface';
import IChatRepository, {
  InsertChatBucketDto,
} from './interfaces/chat.repository.interface';

class ChatRepository implements IChatRepository {
  constructor() {}

  findOne = async (filter: Partial<Omit<ChatBucketDto, 'chatMessages'>>) => {
    const mongoFilter: Filter<ChatBucket> = {
      _id: filter.id ? new ObjectId(filter.id) : undefined,
      channelId: filter.channelId ? new ObjectId(filter.channelId) : undefined,
      startDateTime: filter.startDateTime,
      endDateTime: filter.endDateTime,
      bucketId: filter.bucketId,
    };

    const chatBucket = await collections.chatBuckets!.findOne(mongoFilter, {
      ignoreUndefined: true,
    });

    if (!chatBucket) {
      return null;
    }

    return this.transformChatBucketDto(chatBucket);
  };

  findLatestChatBucket = async (channelId: string) => {
    const mongoFilter: Filter<ChatBucket> = {
      channelId: new ObjectId(channelId),
    };

    const chatBucket = await collections
      .chatBuckets!.find(mongoFilter)
      .sort({ bucketId: -1 })
      .limit(1)
      .next();

    if (!chatBucket) {
      return null;
    }

    return this.transformChatBucketDto(chatBucket);
  };

  insert = async (newRecord: InsertChatBucketDto) => {
    const chatBucketModel = this.transformChatBucketModel(newRecord);

    const result = await collections.chatBuckets!.findOneAndUpdate(
      chatBucketModel,
      { $set: {} },
      { upsert: true, returnDocument: 'after' }
    );

    if (!result.ok || result.value === null) {
      throw new AppError(
        ErrorType.INTERNAL_SERVER_ERROR,
        'Something went wrong',
        undefined,
        {
          message: 'Failed to insert chat bucket',
          object: result,
        }
      );
    }

    return this.transformChatBucketDto(result.value);
  };

  private transformChatMessageDto = (
    chatMessage: WithId<ChatMessage>
  ): ChatMessageDto => {
    return {
      id: chatMessage._id.toString(),
      timestamp: chatMessage.timestamp,
      senderId: chatMessage.senderId.toString(),
      content: chatMessage.content,
      lastModified: chatMessage.lastModified,
    };
  };

  pushChatMessage = async (
    id: string,
    newChatMessage: Omit<ChatMessageDto, 'id'>,
    endDateTime: Date
  ) => {
    const chatMessageModel = this.transformChatMessageModel(newChatMessage);

    const result = await collections.chatBuckets!.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $push: { chatMessages: chatMessageModel },
        $set: { endDateTime },
      },
      { returnDocument: 'after' }
    );

    if (!result.ok || result.value === null) {
      throw new AppError(
        ErrorType.INTERNAL_SERVER_ERROR,
        'Something went wrong',
        undefined,
        {
          message: 'Failed to insert chat message',
          object: result,
        }
      );
    }

    return this.transformChatMessageDto(result.value.chatMessages.at(-1)!);
  };

  private transformChatBucketDto = (
    chatBucket: WithId<ChatBucket>
  ): ChatBucketDto => {
    return {
      id: chatBucket._id.toString(),
      channelId: chatBucket.channelId.toString(),
      startDateTime: chatBucket.startDateTime,
      endDateTime: chatBucket.endDateTime,
      chatMessages: chatBucket.chatMessages.map((chatMessage) =>
        this.transformChatMessageDto(chatMessage)
      ),
      bucketId: chatBucket.bucketId,
    };
  };

  private transformChatMessageModel = (
    chatMessage: Omit<ChatMessageDto, 'id'>
  ): WithId<ChatMessage> => {
    return {
      _id: new ObjectId(),
      timestamp: chatMessage.timestamp,
      senderId: new ObjectId(chatMessage.senderId),
      content: chatMessage.content,
      lastModified: chatMessage.lastModified,
    };
  };

  private transformChatBucketModel = (
    chatBucket: InsertChatBucketDto
  ): ChatBucket => {
    const chatMessages: WithId<ChatMessage>[] = chatBucket.chatMessages.map(
      (chatMessage) => this.transformChatMessageModel(chatMessage)
    );

    return {
      channelId: new ObjectId(chatBucket.channelId),
      startDateTime: chatBucket.startDateTime,
      endDateTime: chatBucket.endDateTime,
      chatMessages: chatMessages,
      bucketId: chatBucket.bucketId,
    };
  };
}

export default ChatRepository;
