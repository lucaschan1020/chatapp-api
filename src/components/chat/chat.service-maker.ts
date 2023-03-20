import PrivateChannelRepository from '../private-channel/private-channel.repository';
import ChatNotification from './chat.notification';
import ChatRepository from './chat.repository';
import ChatService from './chat.service';
import ChatValidator from './chat.validator';
import IChatService from './interfaces/chat.service.interface';

const chatService: IChatService = new ChatService(
  new ChatRepository(),
  new PrivateChannelRepository(),
  new ChatNotification(),
  new ChatValidator()
);

export default chatService;
