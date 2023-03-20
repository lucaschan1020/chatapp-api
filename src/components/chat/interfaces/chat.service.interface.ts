import { UserDto } from '../../../infrastructure/database/schema';

interface ChatMessageResponse {
  id: string;
  timestamp: Date;
  senderId: string;
  content: string | null;
  lastModified: Date;
}

interface ChatBucketResponse {
  channelId: string;
  chatMessages: ChatMessageResponse[];
  bucketId: number;
}

interface IChatService {
  getChatBucket(
    user: UserDto,
    chatBucketInfo: { channelId: string; bucketId: number }
  ): Promise<ChatBucketResponse>;

  getLatestChatBucket(
    user: UserDto,
    channelId: string
  ): Promise<ChatBucketResponse>;

  insertMessage(
    user: UserDto,
    channelId: string,
    content: string
  ): Promise<ChatBucketResponse>;
}

export { ChatMessageResponse, ChatBucketResponse };
export default IChatService;
