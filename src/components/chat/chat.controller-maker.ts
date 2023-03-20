import ChatController from './chat.controller';
import chatService from './chat.service-maker';
import IChatController from './interfaces/chat.controller.interface';

const chatController: IChatController = new ChatController(chatService);

export default chatController;
