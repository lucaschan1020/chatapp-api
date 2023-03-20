import express from 'express';
import { AuthorizedResponse } from '../../../middleware/interfaces/authentication.middleware.interface';

interface GetSpecificPrivateChannelRequest extends express.Request {
  params: {
    privateChannelId: string;
  };
}

interface CreatePrivateChannelRequest extends express.Request {
  body: {
    participants: string[];
    privateChannelName: string;
  };
}

interface IPrivateChannelController {
  get(
    req: GetSpecificPrivateChannelRequest,
    res: AuthorizedResponse
  ): Promise<void>;

  getAll(req: express.Request, res: AuthorizedResponse): Promise<void>;

  post(
    req: CreatePrivateChannelRequest,
    res: AuthorizedResponse
  ): Promise<void>;
}

export {
  GetSpecificPrivateChannelRequest as GetChatBucketRequest,
  CreatePrivateChannelRequest,
};
export default IPrivateChannelController;
