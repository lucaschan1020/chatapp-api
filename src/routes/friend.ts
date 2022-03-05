import express from 'express';
import { constants as httpConstants } from 'http2';
import { WithId, ObjectId } from 'mongodb';
import mongoClient from '../database';
import { User, FriendshipEnum, Friend } from '../database/schema';
import Authorize, {
  AuthorizedResponse,
} from '../middleware/authorization-middleware';
const router = express.Router();

interface AddFriendRequest extends express.Request {
  params: {
    username: string;
    discriminator: string;
  };
}

interface FriendDetail {
  _id?: ObjectId;
  friendship_status?: FriendshipEnum;
  avatar?: string;
  username?: string;
  discriminator?: number;
}

router.get(
  '',
  Authorize,
  async (req: express.Request, res: AuthorizedResponse) => {
    let friends = res.locals.currentUser.friends;
    if (!friends) {
      friends = [];
    }
    const friendIds = friends.map((friend) => friend.friend_id);
    let friendResult: WithId<User>[] | null = null;
    try {
      await mongoClient.connect();
      const userCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<User>('users');
      friendResult = await userCollection
        .find(
          { _id: { $in: friendIds } },
          { projection: { avatar: 1, username: 1, discriminator: 1 } }
        )
        .toArray();
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    } finally {
      await mongoClient.close();
    }
    let friendList = friends.reduce((acc, curr) => {
      acc[curr.friend_id.toString()] = {
        friendship_status: curr.friendship_status,
      };
      return acc;
    }, {} as Record<string, FriendDetail>);
    friendList = friendResult.reduce((acc, curr) => {
      acc[curr._id.toString()] = {
        ...acc[curr._id.toString()],
        _id: curr._id,
        avatar: curr.avatar,
        username: curr.username,
        discriminator: curr.discriminator,
      };
      return acc;
    }, friendList as Record<string, FriendDetail>);
    return res
      .status(httpConstants.HTTP_STATUS_OK)
      .json(Object.values(friendList));
  }
);

router.post(
  '/:username/:discriminator',
  Authorize,
  async (req: AddFriendRequest, res: AuthorizedResponse) => {
    const { username, discriminator } = req.params;
    const currentUser = res.locals.currentUser;
    let toBeFriend: WithId<User> | null = null;
    if (!username || !discriminator) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Missing username or discriminator',
      });
    }

    if (isNaN(discriminator as any)) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Discriminator must be integer',
      });
    }

    try {
      await mongoClient.connect();
      const userCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<User>('users');
      toBeFriend = await userCollection.findOne({
        username: username,
        discriminator: parseInt(discriminator),
      });

      if (!toBeFriend) {
        return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
          message: 'User not found',
        });
      }

      if (
        currentUser.friends.some((friend) =>
          friend.friend_id.equals(toBeFriend!._id)
        )
      ) {
        return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
          message: 'Already added',
        });
      }

      await userCollection.findOneAndUpdate(
        { _id: currentUser._id },
        {
          $push: {
            friends: {
              friend_id: toBeFriend._id,
              friendship_status: FriendshipEnum.Pending,
            },
          },
        }
      );

      await userCollection.findOneAndUpdate(
        { _id: toBeFriend._id },
        {
          $push: {
            friends: {
              friend_id: currentUser._id!,
              friendship_status: FriendshipEnum.Requested,
            },
          },
        }
      );
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    } finally {
      await mongoClient.close();
    }
    const newFriend: FriendDetail = {
      _id: toBeFriend._id,
      friendship_status: FriendshipEnum.Pending,
      avatar: toBeFriend.avatar,
      username: toBeFriend.username,
      discriminator: toBeFriend.discriminator,
    };
    return res.status(httpConstants.HTTP_STATUS_CREATED).json(newFriend);
  }
);

export default router;
