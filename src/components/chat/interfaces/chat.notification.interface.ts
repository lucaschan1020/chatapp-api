import { ChatBucketResponse } from './chat.service.interface';

interface IChatNotification {
  notifyNewChat(
    channelId: string,
    payload: ChatBucketResponse,
    exclusion: string
  ): void;
}

export default IChatNotification;
