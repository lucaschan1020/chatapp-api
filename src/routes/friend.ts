import express from 'express';
import { constants as httpConstants } from 'http2';
import { ObjectId, WithId } from 'mongodb';
import mongoClient from '../database';
import { FriendshipEnum, PrivateChannel, User } from '../database/schema';
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
  friendshipStatus?: FriendshipEnum;
  avatar?: string;
  username?: string;
  discriminator?: number;
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

router.get(
  '',
  Authorize,
  async (req: express.Request, res: AuthorizedResponse) => {
    let friends = res.locals.currentUser.friends;
    if (!friends) {
      friends = [];
    }
    const friendIds = friends.map((friend) => friend.friendId);
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
    let friendList = {} as Record<string, FriendDetail>;

    friends.forEach(
      (friend) =>
        (friendList[friend.friendId.toString()] = {
          friendshipStatus: friend.friendshipStatus,
        })
    );

    friendResult.forEach((friend) => {
      friendList[friend._id.toString()] = {
        ...friendList[friend._id.toString()],
        _id: friend._id,
        avatar: friend.avatar,
        username: friend.username,
        discriminator: friend.discriminator,
      };
    });

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
    let returnFriendDetail: FriendDetail | null = null;
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

    if (
      currentUser.username === username &&
      currentUser.discriminator === parseInt(discriminator)
    ) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Username and discriminator must be other user',
      });
    }

    try {
      await mongoClient.connect();
      const userCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<User>('users');
      let targetFriend = await userCollection.findOne({
        username: username,
        discriminator: parseInt(discriminator),
      });

      if (!targetFriend) {
        return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
          message: 'User not found',
        });
      }

      const userFriendship = currentUser.friends.find((friend) =>
        friend.friendId.equals(targetFriend!._id)
      );

      const targetFriendship = targetFriend.friends.find((friend) =>
        friend.friendId.equals(currentUser._id!)
      );

      if (userFriendship || targetFriendship) {
        if (!userFriendship) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        if (!targetFriendship) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        if (userFriendship.friendshipStatus !== FriendshipEnum.Requested) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        if (targetFriendship.friendshipStatus !== FriendshipEnum.Pending) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        const friendUpdateResult = await userCollection.updateOne(
          {
            _id: targetFriend._id,
            'friends.friendId': currentUser._id,
            'friends.friendshipStatus': FriendshipEnum.Pending,
          },
          { $set: { 'friends.$.friendshipStatus': FriendshipEnum.Friend } }
        );

        if (friendUpdateResult.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        const currentUserUpdateResult = await userCollection.updateOne(
          {
            _id: currentUser._id,
            'friends.friendId': targetFriend._id,
            'friends.friendshipStatus': FriendshipEnum.Requested,
          },
          { $set: { 'friends.$.friendshipStatus': FriendshipEnum.Friend } }
        );

        if (currentUserUpdateResult.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update your friendship status',
          });
        }

        returnFriendDetail = {
          _id: targetFriend._id,
          friendshipStatus: FriendshipEnum.Friend,
          avatar: targetFriend.avatar,
          username: targetFriend.username,
          discriminator: targetFriend.discriminator,
        };
      } else {
        await userCollection.findOneAndUpdate(
          { _id: currentUser._id },
          {
            $push: {
              friends: {
                friendId: targetFriend._id,
                friendshipStatus: FriendshipEnum.Pending,
              },
            },
          }
        );

        await userCollection.findOneAndUpdate(
          { _id: targetFriend._id },
          {
            $push: {
              friends: {
                friendId: currentUser._id!,
                friendshipStatus: FriendshipEnum.Requested,
              },
            },
          }
        );

        returnFriendDetail = {
          _id: targetFriend._id,
          friendshipStatus: FriendshipEnum.Pending,
          avatar: targetFriend.avatar,
          username: targetFriend.username,
          discriminator: targetFriend.discriminator,
        };
      }
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    } finally {
      await mongoClient.close();
    }

    return res
      .status(httpConstants.HTTP_STATUS_CREATED)
      .json(returnFriendDetail);
  }
);

router.put(
  '/:username/:discriminator',
  Authorize,
  async (req: UpdateFriendRequest, res: AuthorizedResponse) => {
    const currentUser = res.locals.currentUser;
    const { username, discriminator } = req.params;
    const { friendshipStatus } = req.body;
    let returnFriendDetail: FriendDetail | null = null;

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

    if (
      currentUser.username === username &&
      currentUser.discriminator === parseInt(discriminator)
    ) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Username and discriminator must be other user',
      });
    }

    if (!friendshipStatus && friendshipStatus !== FriendshipEnum.Pending) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Missing friendship status',
      });
    }

    if (
      friendshipStatus !== FriendshipEnum.Friend &&
      friendshipStatus !== FriendshipEnum.Blocked
    ) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Friendship status out of range',
      });
    }

    try {
      await mongoClient.connect();
      const userCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<User>('users');

      const targetFriend = await userCollection.findOne({
        username: username,
        discriminator: parseInt(discriminator),
      });

      if (!targetFriend) {
        return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
          message: 'User not found',
        });
      }

      const userFriendship = currentUser.friends.find((friend) =>
        friend.friendId.equals(targetFriend._id)
      );

      if (friendshipStatus === FriendshipEnum.Friend) {
        if (!userFriendship) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Friendship is not established',
          });
        }

        const targetFriendship = targetFriend.friends.find((friend) =>
          friend.friendId.equals(currentUser._id!)
        );

        if (!targetFriendship) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Friendship is not established',
          });
        }

        if (
          userFriendship.friendshipStatus !== FriendshipEnum.Requested ||
          targetFriendship.friendshipStatus !== FriendshipEnum.Pending
        ) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        const friendUpdateResult = await userCollection.updateOne(
          {
            _id: targetFriend._id,
            'friends.friendId': currentUser._id,
            'friends.friendshipStatus': FriendshipEnum.Pending,
          },
          { $set: { 'friends.$.friendshipStatus': FriendshipEnum.Friend } }
        );

        if (friendUpdateResult.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        const currentUserUpdateResult = await userCollection.updateOne(
          {
            _id: currentUser._id,
            'friends.friendId': targetFriend._id,
            'friends.friendshipStatus': FriendshipEnum.Requested,
          },
          { $set: { 'friends.$.friendshipStatus': FriendshipEnum.Friend } }
        );

        if (currentUserUpdateResult.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update your friendship status',
          });
        }

        returnFriendDetail = {
          _id: targetFriend._id,
          friendshipStatus: FriendshipEnum.Friend,
          avatar: targetFriend.avatar,
          username: targetFriend.username,
          discriminator: targetFriend.discriminator,
        };
      }

      if (friendshipStatus === FriendshipEnum.Blocked) {
        if (userFriendship?.friendshipStatus === FriendshipEnum.Blocked) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        const currentUserUpdateResult = await userCollection.updateOne(
          {
            _id: currentUser._id,
            'friends.friendId': targetFriend._id,
          },
          { $set: { 'friends.$.friendshipStatus': FriendshipEnum.Blocked } }
        );

        if (currentUserUpdateResult.modifiedCount === 0) {
          await userCollection.findOneAndUpdate(
            { _id: currentUser._id },
            {
              $push: {
                friends: {
                  friendId: targetFriend._id!,
                  friendshipStatus: FriendshipEnum.Blocked,
                },
              },
            }
          );
        }

        const targetFriendship = targetFriend.friends.find((friend) =>
          friend.friendId.equals(currentUser._id!)
        );

        if (targetFriendship?.friendshipStatus !== FriendshipEnum.Blocked) {
          const friendUpdateResult = await userCollection.updateOne(
            {
              _id: targetFriend._id,
            },
            { $pull: { friends: { friendId: currentUser._id } } }
          );

          if (friendUpdateResult.modifiedCount === 0) {
            return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
              message: 'Failed to update your friendship status',
            });
          }
        }

        returnFriendDetail = {
          _id: targetFriend._id,
          friendshipStatus: FriendshipEnum.Blocked,
          avatar: targetFriend.avatar,
          username: targetFriend.username,
          discriminator: targetFriend.discriminator,
        };
      }
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    } finally {
      await mongoClient.close();
    }
    return res.status(httpConstants.HTTP_STATUS_OK).json(returnFriendDetail);
  }
);

router.delete(
  '/:username/:discriminator',
  Authorize,
  async (req: DeleteFriendRequest, res: AuthorizedResponse) => {
    const currentUser = res.locals.currentUser;
    const { username, discriminator } = req.params;
    let returnId = '';

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

    if (
      currentUser.username === username &&
      currentUser.discriminator === parseInt(discriminator)
    ) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Username and discriminator must be other user',
      });
    }

    try {
      await mongoClient.connect();
      const userCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<User>('users');

      const targetFriend = await userCollection.findOne({
        username: username,
        discriminator: parseInt(discriminator),
      });

      if (!targetFriend) {
        return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
          message: 'User not found',
        });
      }

      returnId = targetFriend._id.toString();

      const userFriendship = currentUser.friends.find((friend) =>
        friend.friendId.equals(targetFriend._id)
      );

      if (!userFriendship) {
        return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
          message: 'Friendship is not established',
        });
      }

      const targetFriendship = targetFriend.friends.find((friend) =>
        friend.friendId.equals(currentUser._id!)
      );

      if (
        userFriendship.friendshipStatus === FriendshipEnum.Pending &&
        targetFriendship?.friendshipStatus === FriendshipEnum.Requested
      ) {
        const friendUpdateResult = await userCollection.updateOne(
          {
            _id: targetFriend._id,
          },
          { $pull: { friends: { friendId: currentUser._id } } }
        );

        if (friendUpdateResult.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update your friendship status',
          });
        }
      }

      if (userFriendship.friendshipStatus === FriendshipEnum.Requested) {
        if (!targetFriendship) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Friendship is not established',
          });
        }

        if (targetFriendship.friendshipStatus !== FriendshipEnum.Pending) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }
      }

      if (userFriendship.friendshipStatus === FriendshipEnum.Friend) {
        if (!targetFriendship) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Friendship is not established',
          });
        }

        if (targetFriendship.friendshipStatus !== FriendshipEnum.Friend) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        const friendUpdateResult = await userCollection.updateOne(
          {
            _id: targetFriend._id,
          },
          { $pull: { friends: { friendId: currentUser._id } } }
        );

        if (friendUpdateResult.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update your friendship status',
          });
        }
      }

      const currentUserUpdateResult = await userCollection.updateOne(
        {
          _id: currentUser._id,
        },
        { $pull: { friends: { friendId: targetFriend._id } } }
      );

      if (currentUserUpdateResult.modifiedCount === 0) {
        return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
          message: 'Failed to update your friendship status',
        });
      }
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    } finally {
      await mongoClient.close();
    }

    return res.status(httpConstants.HTTP_STATUS_OK).json(returnId);
  }
);

export default router;
