import express from 'express';
import { constants as httpConstants } from 'http2';
import { AuthorizedResponse } from '../../middleware/interfaces/authentication.middleware.interface';
import IPrivateChannelController, {
  CreatePrivateChannelRequest,
  GetChatBucketRequest,
} from './interfaces/private-channel.controller.interface';
import IPrivateChannelService from './interfaces/private-channel.service.interface';

class PrivateChannelController implements IPrivateChannelController {
  constructor(private readonly privateChannelService: IPrivateChannelService) {}
  get = async (req: GetChatBucketRequest, res: AuthorizedResponse) => {
    const { privateChannelId } = req.params;
    const response = await this.privateChannelService.getPrivateChannel(
      res.locals.currentUser,
      privateChannelId
    );
    res.status(httpConstants.HTTP_STATUS_OK).json(response);
    return;
  };

  getAll = async (req: express.Request, res: AuthorizedResponse) => {
    const response = await this.privateChannelService.getAllPrivateChannels(
      res.locals.currentUser
    );
    res.status(httpConstants.HTTP_STATUS_OK).json(response);
    return;
  };

  post = async (req: CreatePrivateChannelRequest, res: AuthorizedResponse) => {
    const { participants, privateChannelName } = req.body;
    const response = await this.privateChannelService.createPrivateChannel(
      res.locals.currentUser,
      { participants, privateChannelName }
    );
    res.status(httpConstants.HTTP_STATUS_CREATED).json(response);
    return;
  };
}

export default PrivateChannelController;
