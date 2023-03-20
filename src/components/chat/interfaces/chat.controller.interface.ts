import express from 'express';
import { AuthorizedResponse } from '../../../middleware/interfaces/authentication.middleware.interface';

interface GetLatestChatBucketRequest extends express.Request {
  params: {
    privateChannelId: string;
  };
}

interface GetChatBucketRequest extends express.Request {
  params: {
    privateChannelId: string;
    bucketId: string;
  };
}

interface CreateChatBucketRequest extends express.Request {
  params: {
    privateChannelId: string;
  };
  body: {
    content: string;
  };
}

interface IChatController {
  get(req: GetChatBucketRequest, res: AuthorizedResponse): Promise<void>;

  getLatest(
    req: GetLatestChatBucketRequest,
    res: AuthorizedResponse
  ): Promise<void>;

  post(req: CreateChatBucketRequest, res: AuthorizedResponse): Promise<void>;
}

export {
  GetLatestChatBucketRequest,
  GetChatBucketRequest,
  CreateChatBucketRequest,
};
export default IChatController;
