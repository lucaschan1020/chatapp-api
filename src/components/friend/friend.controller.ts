import express from 'express';
import { constants as httpConstants } from 'http2';
import { AuthorizedResponse } from '../../middleware/interfaces/authentication.middleware.interface';
import IFriendController, {
  AddFriendRequest,
  DeleteFriendRequest,
  GetFriendRequest,
  UpdateFriendRequest,
} from './interfaces/friend.controller.interface';
import IFriendService from './interfaces/friend.service.interface';

class FriendController implements IFriendController {
  constructor(private readonly friendService: IFriendService) {}

  getAll = async (req: express.Request, res: AuthorizedResponse) => {
    const result = await this.friendService.getAllFriends(
      res.locals.currentUser
    );

    res.status(httpConstants.HTTP_STATUS_OK).json(result);
  };

  get = async (req: GetFriendRequest, res: AuthorizedResponse) => {
    const { username, discriminator } = req.params;

    const result = await this.friendService.getFriend(res.locals.currentUser, {
      username,
      discriminator: parseInt(discriminator),
    });
    res.status(httpConstants.HTTP_STATUS_OK).json(result);
    return;
  };

  post = async (req: AddFriendRequest, res: AuthorizedResponse) => {
    const { username, discriminator } = req.params;

    const result = await this.friendService.tryAddFriend(
      res.locals.currentUser,
      {
        username,
        discriminator: parseInt(discriminator),
      }
    );
    res.status(httpConstants.HTTP_STATUS_CREATED).json(result);
    return;
  };

  put = async (req: UpdateFriendRequest, res: AuthorizedResponse) => {
    const { username, discriminator } = req.params;
    const { friendshipStatus } = req.body;

    const result = await this.friendService.tryUpdateFriend(
      res.locals.currentUser,
      {
        username,
        discriminator: parseInt(discriminator),
      },
      friendshipStatus
    );
    res.status(httpConstants.HTTP_STATUS_OK).json(result);
    return;
  };

  delete = async (req: DeleteFriendRequest, res: AuthorizedResponse) => {
    const { username, discriminator } = req.params;

    const result = await this.friendService.tryRemoveFriend(
      res.locals.currentUser,
      {
        username,
        discriminator: parseInt(discriminator),
      }
    );
    res.status(httpConstants.HTTP_STATUS_OK).json(result);
    return;
  };
}

export default FriendController;
