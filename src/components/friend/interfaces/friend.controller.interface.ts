import express from 'express';
import { FriendshipEnum } from '../../../infrastructure/database/schema';
import { AuthorizedResponse } from '../../../middleware/interfaces/authentication.middleware.interface';

interface GetFriendRequest extends express.Request {
  params: {
    username: string;
    discriminator: string;
  };
}

interface AddFriendRequest extends express.Request {
  params: {
    username: string;
    discriminator: string;
  };
}

interface UpdateFriendRequest extends express.Request {
  params: {
    username: string;
    discriminator: string;
  };
  body: {
    friendshipStatus: FriendshipEnum;
  };
}

interface DeleteFriendRequest extends express.Request {
  params: {
    username: string;
    discriminator: string;
  };
}

interface IFriendController {
  getAll(req: express.Request, res: AuthorizedResponse): Promise<void>;
  get(req: GetFriendRequest, res: AuthorizedResponse): Promise<void>;
  post(req: AddFriendRequest, res: AuthorizedResponse): Promise<void>;
  put(req: UpdateFriendRequest, res: AuthorizedResponse): Promise<void>;
  delete(req: DeleteFriendRequest, res: AuthorizedResponse): Promise<void>;
}

export {
  GetFriendRequest,
  AddFriendRequest,
  UpdateFriendRequest,
  DeleteFriendRequest,
};
export default IFriendController;
