import {
  ChatBucketDto,
  ChatMessageDto,
} from '../../../infrastructure/database/schema';
import { ChangeFields } from '../../../utilities/utility-types';

type InsertChatBucketDto = ChangeFields<
  Omit<ChatBucketDto, 'id'>,
  {
    chatMessages: Omit<ChatMessageDto, 'id'>[];
  }
>;

interface IChatRepository {
  findOne(
    filter: Partial<Omit<ChatBucketDto, 'chatMessages'>>
  ): Promise<ChatBucketDto | null>;
  findLatestChatBucket(channelId: string): Promise<ChatBucketDto | null>;
  insert(newRecord: InsertChatBucketDto): Promise<ChatBucketDto>;
  pushChatMessage(
    id: string,
    newChatMessage: Omit<ChatMessageDto, 'id'>,
    endDateTime: Date
  ): Promise<ChatMessageDto>;
}

export { InsertChatBucketDto };
export default IChatRepository;
