import express from 'express';
import { constants as httpConstants } from 'http2';
import { InsertOneResult, ObjectId, WithId } from 'mongodb';
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

interface FriendResponse {
  friendshipStatus: FriendshipEnum | null;
  avatar: string;
  username: string;
  discriminator: number;
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
    const friends = res.locals.currentUser.friends;
    const friendIds = Object.values(friends)
      .filter((friend) => {
        if (friend.friendshipStatus === null) return false;
        return true;
      })
      .map((friend) => friend.friendId);
    let friendResult: WithId<User>[] | null = null;
    try {
      await mongoClient.connect();
      const userCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<User>('users');

      friendResult = await userCollection
        .find(
          {
            _id: { $in: friendIds },
          },
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
    let friendResponse = {} as Record<string, Partial<WithId<FriendResponse>>>;
    Object.values(friends).forEach((friend) => {
      if (friend.friendshipStatus == null) return;
      friendResponse[friend.friendId.toString()] = {
        friendshipStatus: friend.friendshipStatus,
      };
    });

    friendResult.forEach((friend) => {
      friendResponse[friend._id.toString()] = {
        ...friendResponse[friend._id.toString()],
        _id: friend._id,
        avatar: friend.avatar,
        username: friend.username,
        discriminator: friend.discriminator,
      };
    });

    return res.status(httpConstants.HTTP_STATUS_OK).json(friendResponse);
  }
);

router.post(
  '/:username/:discriminator',
  Authorize,
  async (req: AddFriendRequest, res: AuthorizedResponse) => {
    const { username, discriminator } = req.params;
    const currentUser = res.locals.currentUser;
    let returnFriendDetail: WithId<FriendResponse> | null = null;
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
      const privateChannelCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<PrivateChannel>('privateChannels');

      const targetFriend = await userCollection.findOne({
        username: username,
        discriminator: parseInt(discriminator),
      });

      if (!targetFriend) {
        return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
          message: 'User not found',
        });
      }

      const userFriendship = currentUser.friends[targetFriend._id.toString()];
      const targetFriendship = targetFriend.friends[currentUser._id.toString()];

      if (
        (userFriendship && userFriendship.friendshipStatus != null) ||
        (targetFriendship && targetFriendship.friendshipStatus != null)
      ) {
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

        if (userFriendship.friendshipStatus === FriendshipEnum.Pending) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Already sent friend request',
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

        let newPrivateChannel: InsertOneResult<PrivateChannel> | null = null;
        if (
          !userFriendship.privateChannelId ||
          !targetFriendship.privateChannelId
        ) {
          const createdDate = new Date();
          newPrivateChannel = await privateChannelCollection.insertOne({
            privateChannelName: '',
            dateCreated: createdDate,
            isGroup: false,
          });
        }

        const updatedCurrentUser = await userCollection.findOneAndUpdate(
          { _id: currentUser._id },
          [
            {
              $set: {
                [`friends.${targetFriend._id.toString()}.friendshipStatus`]:
                  FriendshipEnum.Friend,
                [`friends.${targetFriend._id.toString()}.privateChannelId`]: {
                  $cond: [
                    {
                      $not: [
                        `$friends.${targetFriend._id.toString()}.privateChannelId`,
                      ],
                    },
                    newPrivateChannel?.insertedId,
                    `$friends.${targetFriend._id.toString()}.privateChannelId`,
                  ],
                },
                [`friends.${targetFriend._id.toString()}.active`]: true,
              },
            },
          ],
          {
            returnDocument: 'after',
          }
        );

        const updatedTargetFriend = await userCollection.findOneAndUpdate(
          { _id: targetFriend._id },
          [
            {
              $set: {
                [`friends.${currentUser._id.toString()}.friendshipStatus`]:
                  FriendshipEnum.Friend,
                [`friends.${currentUser._id.toString()}.privateChannelId`]: {
                  $cond: [
                    {
                      $not: [
                        `$friends.${currentUser._id.toString()}.privateChannelId`,
                      ],
                    },
                    newPrivateChannel?.insertedId,
                    `$friends.${currentUser._id.toString()}.privateChannelId`,
                  ],
                },
                [`friends.${currentUser._id.toString()}.active`]: true,
              },
            },
          ],
          {
            returnDocument: 'after',
          }
        );

        returnFriendDetail = {
          _id: targetFriend._id,
          friendshipStatus: FriendshipEnum.Friend,
          avatar: targetFriend.avatar,
          username: targetFriend.username,
          discriminator: targetFriend.discriminator,
        };
      } else {
        const friendUpdateResult = await userCollection.updateOne(
          {
            _id: targetFriend._id,
          },
          {
            $set: {
              [`friends.${currentUser._id.toString()}.friendId`]:
                currentUser._id,
              [`friends.${currentUser._id.toString()}.friendshipStatus`]:
                FriendshipEnum.Requested,
            },
          }
        );

        if (friendUpdateResult.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        const currentUserUpdateResult = await userCollection.updateOne(
          {
            _id: currentUser._id,
          },
          {
            $set: {
              [`friends.${targetFriend._id.toString()}.friendId`]:
                targetFriend._id,
              [`friends.${targetFriend._id.toString()}.friendshipStatus`]:
                FriendshipEnum.Pending,
            },
          }
        );

        if (currentUserUpdateResult.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update your friendship status',
          });
        }

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
    let returnFriendDetail: WithId<FriendResponse> | null = null;

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

    // !friendshipStatus will include FriendshipEnum.Pending (0), hence need to exclude
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
      const privateChannelCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<PrivateChannel>('privateChannels');

      const targetFriend = await userCollection.findOne({
        username: username,
        discriminator: parseInt(discriminator),
      });

      if (!targetFriend) {
        return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
          message: 'User not found',
        });
      }

      const userFriendship = currentUser.friends[targetFriend._id.toString()];
      const targetFriendship = targetFriend.friends[currentUser._id.toString()];

      if (friendshipStatus === FriendshipEnum.Friend) {
        if (!userFriendship || userFriendship.friendshipStatus === null) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Friendship is not established',
          });
        }

        if (!targetFriendship || targetFriendship.friendshipStatus === null) {
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

        let newPrivateChannel: InsertOneResult<PrivateChannel> | null = null;
        if (
          !userFriendship.privateChannelId ||
          !targetFriendship.privateChannelId
        ) {
          const createdDate = new Date();
          newPrivateChannel = await privateChannelCollection.insertOne({
            privateChannelName: '',
            dateCreated: createdDate,
            isGroup: false,
          });
        }

        const updatedCurrentUser = await userCollection.findOneAndUpdate(
          { _id: currentUser._id },
          [
            {
              $set: {
                [`friends.${targetFriend._id.toString()}.friendshipStatus`]:
                  FriendshipEnum.Friend,
                [`friends.${targetFriend._id.toString()}.privateChannelId`]: {
                  $cond: [
                    {
                      $not: [
                        `$friends.${targetFriend._id.toString()}.privateChannelId`,
                      ],
                    },
                    newPrivateChannel?.insertedId,
                    `$friends.${targetFriend._id.toString()}.privateChannelId`,
                  ],
                },
                [`friends.${targetFriend._id.toString()}.active`]: true,
              },
            },
          ],
          {
            returnDocument: 'after',
          }
        );

        const updatedTargetFriend = await userCollection.findOneAndUpdate(
          { _id: targetFriend._id },
          [
            {
              $set: {
                [`friends.${currentUser._id.toString()}.friendshipStatus`]:
                  FriendshipEnum.Friend,
                [`friends.${currentUser._id.toString()}.privateChannelId`]: {
                  $cond: [
                    {
                      $not: [
                        `$friends.${currentUser._id.toString()}.privateChannelId`,
                      ],
                    },
                    newPrivateChannel?.insertedId,
                    `$friends.${currentUser._id.toString()}.privateChannelId`,
                  ],
                },
                [`friends.${currentUser._id.toString()}.active`]: true,
              },
            },
          ],
          {
            returnDocument: 'after',
          }
        );

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
          },
          {
            $set: {
              [`friends.${targetFriend._id.toString()}.friendId`]:
                targetFriend._id,
              [`friends.${targetFriend._id.toString()}.friendshipStatus`]:
                FriendshipEnum.Blocked,
            },
          }
        );

        if (currentUserUpdateResult.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update your friendship status',
          });
        }

        if (
          targetFriendship?.friendshipStatus !== FriendshipEnum.Blocked &&
          targetFriendship?.friendshipStatus !== null
        ) {
          const friendUpdateResult = await userCollection.updateOne(
            {
              _id: targetFriend._id,
            },
            {
              $set: {
                [`friends.${currentUser._id.toString()}.friendshipStatus`]:
                  null,
              },
            }
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

      const userFriendship = currentUser.friends[targetFriend._id.toString()];

      if (!userFriendship || userFriendship.friendshipStatus === null) {
        return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
          message: 'Friendship is not established',
        });
      }

      const targetFriendship = targetFriend.friends[currentUser._id.toString()];

      if (
        userFriendship.friendshipStatus === FriendshipEnum.Pending &&
        targetFriendship?.friendshipStatus === FriendshipEnum.Requested
      ) {
        const friendUpdateResult = await userCollection.updateOne(
          {
            _id: targetFriend._id,
          },
          {
            $set: {
              [`friends.${currentUser._id.toString()}.friendshipStatus`]: null,
            },
          }
        );

        if (friendUpdateResult.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update your friendship status',
          });
        }
      }

      if (userFriendship.friendshipStatus === FriendshipEnum.Requested) {
        if (!targetFriendship || targetFriendship.friendshipStatus === null) {
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
        if (!targetFriendship || targetFriendship.friendshipStatus === null) {
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
          {
            $set: {
              [`friends.${currentUser._id.toString()}.friendshipStatus`]: null,
            },
          }
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
        {
          $set: {
            [`friends.${targetFriend._id.toString()}.friendshipStatus`]: null,
          },
        }
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
