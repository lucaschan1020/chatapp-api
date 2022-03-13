import express from 'express';
import { constants as httpConstants } from 'http2';
import { ObjectId, WithId } from 'mongodb';
import mongoClient from '../database';
import { FriendshipEnum, User } from '../database/schema';
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

interface UpdateFriendRequest extends express.Request {
  params: {
    username: string;
    discriminator: string;
  };
  body: {
    friendship_status: FriendshipEnum;
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
    let friendList = {} as Record<string, FriendDetail>;

    friends.forEach(
      (friend) =>
        (friendList[friend.friend_id.toString()] = {
          friendship_status: friend.friendship_status,
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
    let toBeFriend: WithId<User> | null = null;
    let isRequested = false;
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
      toBeFriend = await userCollection.findOne({
        username: username,
        discriminator: parseInt(discriminator),
      });

      if (!toBeFriend) {
        return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
          message: 'User not found',
        });
      }

      const userFriendship = currentUser.friends.find((friend) =>
        friend.friend_id.equals(toBeFriend!._id)
      );

      const targetFriendship = toBeFriend.friends.find((friend) =>
        friend.friend_id.equals(currentUser._id!)
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

        if (userFriendship.friendship_status !== FriendshipEnum.Requested) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        if (targetFriendship.friendship_status !== FriendshipEnum.Pending) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        const friendUpdateResult = await userCollection.updateOne(
          {
            _id: toBeFriend._id,
            'friends.friend_id': currentUser._id,
            'friends.friendship_status': FriendshipEnum.Pending,
          },
          { $set: { 'friends.$.friendship_status': FriendshipEnum.Friend } }
        );

        if (friendUpdateResult.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        const currentUserUpdateResult = await userCollection.updateOne(
          {
            _id: currentUser._id,
            'friends.friend_id': toBeFriend._id,
            'friends.friendship_status': FriendshipEnum.Requested,
          },
          { $set: { 'friends.$.friendship_status': FriendshipEnum.Friend } }
        );

        if (currentUserUpdateResult.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update your friendship status',
          });
        }

        isRequested = true;
      } else {
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
      }
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
      friendship_status: isRequested
        ? FriendshipEnum.Friend
        : FriendshipEnum.Pending,
      avatar: toBeFriend.avatar,
      username: toBeFriend.username,
      discriminator: toBeFriend.discriminator,
    };
    return res.status(httpConstants.HTTP_STATUS_CREATED).json(newFriend);
  }
);

router.put(
  '/:username/:discriminator',
  Authorize,
  async (req: UpdateFriendRequest, res: AuthorizedResponse) => {
    const currentUser = res.locals.currentUser;
    const { username, discriminator } = req.params;
    const { friendship_status } = req.body;

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

    if (!friendship_status && friendship_status !== FriendshipEnum.Pending) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Missing friendship status',
      });
    }

    if (
      friendship_status !== FriendshipEnum.Friend &&
      friendship_status !== FriendshipEnum.Blocked
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

      if (friendship_status === FriendshipEnum.Friend) {
        const userFriendship = currentUser.friends.find((friend) =>
          friend.friend_id.equals(targetFriend._id)
        );

        if (!userFriendship) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Friendship is not established',
          });
        }

        const targetFriendship = targetFriend.friends.find((friend) =>
          friend.friend_id.equals(currentUser._id!)
        );

        if (!targetFriendship) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Friendship is not established',
          });
        }

        if (
          userFriendship.friendship_status !== FriendshipEnum.Requested ||
          targetFriendship.friendship_status !== FriendshipEnum.Pending
        ) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        const friendUpdateResult = await userCollection.updateOne(
          {
            _id: targetFriend._id,
            'friends.friend_id': currentUser._id,
            'friends.friendship_status': FriendshipEnum.Pending,
          },
          { $set: { 'friends.$.friendship_status': FriendshipEnum.Friend } }
        );

        if (friendUpdateResult.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        const currentUserUpdateResult = await userCollection.updateOne(
          {
            _id: currentUser._id,
            'friends.friend_id': targetFriend._id,
            'friends.friendship_status': FriendshipEnum.Requested,
          },
          { $set: { 'friends.$.friendship_status': FriendshipEnum.Friend } }
        );

        if (currentUserUpdateResult.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update your friendship status',
          });
        }
      }

      if (friendship_status === FriendshipEnum.Blocked) {
        const userFriendship = currentUser.friends.find((friend) =>
          friend.friend_id.equals(targetFriend._id)
        );

        if (userFriendship?.friendship_status === FriendshipEnum.Blocked) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        const currentUserUpdateResult = await userCollection.updateOne(
          {
            _id: currentUser._id,
            'friends.friend_id': targetFriend._id,
          },
          { $set: { 'friends.$.friendship_status': FriendshipEnum.Blocked } }
        );

        if (currentUserUpdateResult.modifiedCount === 0) {
          await userCollection.findOneAndUpdate(
            { _id: currentUser._id },
            {
              $push: {
                friends: {
                  friend_id: targetFriend._id!,
                  friendship_status: FriendshipEnum.Blocked,
                },
              },
            }
          );
        }

        const targetFriendship = targetFriend.friends.find((friend) =>
          friend.friend_id.equals(currentUser._id!)
        );

        if (targetFriendship?.friendship_status !== FriendshipEnum.Blocked) {
          const friendUpdateResult = await userCollection.updateOne(
            {
              _id: targetFriend._id,
            },
            { $pull: { friends: { friend_id: currentUser._id } } }
          );

          if (friendUpdateResult.modifiedCount === 0) {
            return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
              message: 'Failed to update your friendship status',
            });
          }
        }
      }
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    } finally {
      await mongoClient.close();
    }
    return res.status(httpConstants.HTTP_STATUS_NO_CONTENT).json();
  }
);

router.delete(
  '/:username/:discriminator',
  Authorize,
  async (req: DeleteFriendRequest, res: AuthorizedResponse) => {
    const currentUser = res.locals.currentUser;
    const { username, discriminator } = req.params;

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

      const userFriendship = currentUser.friends.find((friend) =>
        friend.friend_id.equals(targetFriend._id)
      );

      if (!userFriendship) {
        return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
          message: 'Friendship is not established',
        });
      }

      const targetFriendship = targetFriend.friends.find((friend) =>
        friend.friend_id.equals(currentUser._id!)
      );

      if (
        userFriendship.friendship_status === FriendshipEnum.Pending &&
        targetFriendship?.friendship_status === FriendshipEnum.Requested
      ) {
        const friendUpdateResult = await userCollection.updateOne(
          {
            _id: targetFriend._id,
          },
          { $pull: { friends: { friend_id: currentUser._id } } }
        );

        if (friendUpdateResult.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update your friendship status',
          });
        }
      }

      if (userFriendship.friendship_status === FriendshipEnum.Requested) {
        if (!targetFriendship) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Friendship is not established',
          });
        }

        if (targetFriendship.friendship_status !== FriendshipEnum.Pending) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }
      }

      if (userFriendship.friendship_status === FriendshipEnum.Friend) {
        if (!targetFriendship) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Friendship is not established',
          });
        }

        if (targetFriendship.friendship_status !== FriendshipEnum.Friend) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        const friendUpdateResult = await userCollection.updateOne(
          {
            _id: targetFriend._id,
          },
          { $pull: { friends: { friend_id: currentUser._id } } }
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
        { $pull: { friends: { friend_id: targetFriend._id } } }
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

    return res.status(httpConstants.HTTP_STATUS_NO_CONTENT).json();
  }
);

export default router;
