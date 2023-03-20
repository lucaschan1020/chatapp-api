import { io } from '../../infrastructure/socket-io';
import IChatNotification from './interfaces/chat.notification.interface';
import { ChatBucketResponse } from './interfaces/chat.service.interface';

class ChatNotification implements IChatNotification {
  constructor() {}
  notifyNewChat(
    channelId: string,
    payload: ChatBucketResponse,
    exclusion: string
  ): void {
    io.to(`privateChannel:${channelId}`)
      .except(`user:${exclusion}`)
      .emit('sendPrivateChannelChat', payload);
  }
}

export default ChatNotification;
