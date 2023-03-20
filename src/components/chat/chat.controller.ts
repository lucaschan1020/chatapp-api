import { constants as httpConstants } from 'http2';
import { AuthorizedResponse } from '../../middleware/interfaces/authentication.middleware.interface';
import IChatController, {
  CreateChatBucketRequest,
  GetChatBucketRequest,
  GetLatestChatBucketRequest,
} from './interfaces/chat.controller.interface';
import IChatService from './interfaces/chat.service.interface';

class ChatController implements IChatController {
  constructor(private readonly chatService: IChatService) {}

  get = async (req: GetChatBucketRequest, res: AuthorizedResponse) => {
    const { privateChannelId, bucketId } = req.params;
    const response = await this.chatService.getChatBucket(
      res.locals.currentUser,
      { channelId: privateChannelId, bucketId: parseInt(bucketId as any) }
    );
    res.status(httpConstants.HTTP_STATUS_OK).json(response);
    return;
  };

  getLatest = async (
    req: GetLatestChatBucketRequest,
    res: AuthorizedResponse
  ) => {
    const { privateChannelId } = req.params;
    const response = await this.chatService.getLatestChatBucket(
      res.locals.currentUser,
      privateChannelId
    );
    res.status(httpConstants.HTTP_STATUS_OK).json(response);
    return;
  };

  post = async (req: CreateChatBucketRequest, res: AuthorizedResponse) => {
    const { privateChannelId } = req.params;
    const { content } = req.body;
    const response = await this.chatService.insertMessage(
      res.locals.currentUser,
      privateChannelId,
      content
    );

    res.status(httpConstants.HTTP_STATUS_CREATED).json(response);
  };
}

export default ChatController;
