import express from 'express';
import { constants as httpConstants } from 'http2';
import { InsertOneResult, ObjectId, WithId } from 'mongodb';
import { collections } from '../database';
import { FriendshipEnum, PrivateChannel, User } from '../database/schema';
import Authorize, {
  AuthorizedResponse,
} from '../middleware/authorization-middleware';
import { emitNewPrivateChannel, emitUpdateFriendshipStatus } from '../socketIO';
import { PrivateChannelResponse } from './privateChannel';
const router = express.Router();

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

export interface FriendResponse {
  friendshipStatus: FriendshipEnum | null;
  privateChannelId?: string;
  avatar: string;
  username: string;
  discriminator: number;
}

router.get(
  '/:username/:discriminator',
  Authorize,
  async (req: GetFriendRequest, res: AuthorizedResponse) => {
    const { username, discriminator } = req.params;
    const currentUser = res.locals.currentUser;
    let friendResponse: WithId<FriendResponse> | null = null;
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
      const targetFriend = await collections.users!.findOne({
        username: username,
        discriminator: parseInt(discriminator),
      });

      if (!targetFriend) {
        return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
          message: 'User not found',
        });
      }

      const userFriendship = currentUser.friends[targetFriend._id.toString()];

      friendResponse = {
        _id: targetFriend._id,
        friendshipStatus: userFriendship.friendshipStatus ?? null,
        privateChannelId: userFriendship.privateChannelId?.toString(),
        avatar: targetFriend.avatar,
        username: targetFriend.username,
        discriminator: targetFriend.discriminator,
      };
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    }

    return res.status(httpConstants.HTTP_STATUS_OK).json(friendResponse);
  }
);

router.get(
  '',
  Authorize,
  async (req: express.Request, res: AuthorizedResponse) => {
    const friends = res.locals.currentUser.friends;
    const friendIds = Object.values(friends).map((friend) => friend.friendId);
    let friendResult: WithId<User>[] | null = null;
    try {
      friendResult = await collections
        .users!.find(
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
    }

    let friendResponse = {} as Record<string, Partial<WithId<FriendResponse>>>;
    Object.values(friends).forEach((friend) => {
      friendResponse[friend.friendId.toString()] = {
        friendshipStatus: friend.friendshipStatus,
        privateChannelId: friend.privateChannelId?.toString(),
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
    let currentUserFriendResponse: WithId<FriendResponse>;
    let targetFriendResponse: WithId<FriendResponse>;
    let currentUserNewPrivateChannelResponse: WithId<PrivateChannelResponse> | null =
      null;
    let targetFriendNewPrivateChannelResponse: WithId<PrivateChannelResponse> | null =
      null;
    let friendId: ObjectId | null = null;
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
      const targetFriend = await collections.users!.findOne({
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
        (userFriendship && userFriendship.friendshipStatus !== null) ||
        (targetFriendship && targetFriendship.friendshipStatus !== null)
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

        if (targetFriendship.friendshipStatus !== FriendshipEnum.Pending) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        if (
          userFriendship.friendshipStatus !== null &&
          userFriendship.friendshipStatus !== FriendshipEnum.Requested
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
          newPrivateChannel = await collections.privateChannels!.insertOne({
            privateChannelName: '',
            dateCreated: createdDate,
            isGroup: false,
          });

          currentUserNewPrivateChannelResponse = {
            _id: newPrivateChannel.insertedId,
            participants: [
              {
                _id: targetFriend._id.toString(),
                avatar: targetFriend.avatar,
                username: targetFriend.username,
                discriminator: targetFriend.discriminator,
              },
            ],
            privateChannelName: '',
            dateCreated: createdDate,
            isGroup: false,
          };

          targetFriendNewPrivateChannelResponse = {
            _id: newPrivateChannel.insertedId,
            participants: [
              {
                _id: currentUser._id.toString(),
                avatar: currentUser.avatar,
                username: currentUser.username,
                discriminator: currentUser.discriminator,
              },
            ],
            privateChannelName: '',
            dateCreated: createdDate,
            isGroup: false,
          };
          friendId = targetFriend._id;
        }

        const updatedCurrentUser = await collections.users!.findOneAndUpdate(
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

        const updatedTargetFriend = await collections.users!.findOneAndUpdate(
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

        currentUserFriendResponse = {
          _id: targetFriend._id,
          friendshipStatus: FriendshipEnum.Friend,
          privateChannelId:
            updatedCurrentUser.value!.friends[
              targetFriend._id.toString()
            ].privateChannelId?.toString(),
          avatar: targetFriend.avatar,
          username: targetFriend.username,
          discriminator: targetFriend.discriminator,
        };

        targetFriendResponse = {
          _id: currentUser._id,
          friendshipStatus: FriendshipEnum.Friend,
          privateChannelId:
            updatedTargetFriend.value!.friends[
              currentUser._id.toString()
            ].privateChannelId?.toString(),
          avatar: currentUser.avatar,
          username: currentUser.username,
          discriminator: currentUser.discriminator,
        };
      } else {
        const friendUpdateResult = await collections.users!.updateOne(
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

        const currentUserUpdateResult = await collections.users!.updateOne(
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

        currentUserFriendResponse = {
          _id: targetFriend._id,
          friendshipStatus: FriendshipEnum.Pending,
          privateChannelId: userFriendship.privateChannelId?.toString(),
          avatar: targetFriend.avatar,
          username: targetFriend.username,
          discriminator: targetFriend.discriminator,
        };

        targetFriendResponse = {
          _id: currentUser._id,
          friendshipStatus: FriendshipEnum.Requested,
          privateChannelId: targetFriendship.privateChannelId?.toString(),
          avatar: currentUser.avatar,
          username: currentUser.username,
          discriminator: currentUser.discriminator,
        };
      }
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    }

    emitUpdateFriendshipStatus(currentUser._id, currentUserFriendResponse);
    emitUpdateFriendshipStatus(
      currentUserFriendResponse._id,
      targetFriendResponse
    );

    if (
      currentUserNewPrivateChannelResponse !== null &&
      targetFriendNewPrivateChannelResponse !== null
    ) {
      emitNewPrivateChannel(
        [currentUser._id],
        currentUserNewPrivateChannelResponse
      );
      emitNewPrivateChannel([friendId!], targetFriendNewPrivateChannelResponse);
    }

    return res
      .status(httpConstants.HTTP_STATUS_CREATED)
      .json(currentUserFriendResponse);
  }
);

router.put(
  '/:username/:discriminator',
  Authorize,
  async (req: UpdateFriendRequest, res: AuthorizedResponse) => {
    const currentUser = res.locals.currentUser;
    const { username, discriminator } = req.params;
    const { friendshipStatus } = req.body;
    let currentUserFriendResponse: WithId<FriendResponse> | null = null;
    let targetFriendResponse: WithId<FriendResponse> | null = null;
    let currentUserNewPrivateChannelResponse: WithId<PrivateChannelResponse> | null =
      null;
    let targetFriendNewPrivateChannelResponse: WithId<PrivateChannelResponse> | null =
      null;
    let friendId: ObjectId | null = null;

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
      const targetFriend = await collections.users!.findOne({
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
          newPrivateChannel = await collections.privateChannels!.insertOne({
            privateChannelName: '',
            dateCreated: createdDate,
            isGroup: false,
          });

          currentUserNewPrivateChannelResponse = {
            _id: newPrivateChannel.insertedId,
            participants: [
              {
                _id: targetFriend._id.toString(),
                avatar: targetFriend.avatar,
                username: targetFriend.username,
                discriminator: targetFriend.discriminator,
              },
            ],
            privateChannelName: '',
            dateCreated: createdDate,
            isGroup: false,
          };

          targetFriendNewPrivateChannelResponse = {
            _id: newPrivateChannel.insertedId,
            participants: [
              {
                _id: currentUser._id.toString(),
                avatar: currentUser.avatar,
                username: currentUser.username,
                discriminator: currentUser.discriminator,
              },
            ],
            privateChannelName: '',
            dateCreated: createdDate,
            isGroup: false,
          };
          friendId = targetFriend._id;
        }

        const updatedCurrentUser = await collections.users!.findOneAndUpdate(
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

        const updatedTargetFriend = await collections.users!.findOneAndUpdate(
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

        currentUserFriendResponse = {
          _id: targetFriend._id,
          friendshipStatus: FriendshipEnum.Friend,
          privateChannelId:
            updatedCurrentUser.value!.friends[
              targetFriend._id.toString()
            ].privateChannelId?.toString(),
          avatar: targetFriend.avatar,
          username: targetFriend.username,
          discriminator: targetFriend.discriminator,
        };

        targetFriendResponse = {
          _id: currentUser._id,
          friendshipStatus: FriendshipEnum.Friend,
          privateChannelId:
            updatedTargetFriend.value!.friends[
              currentUser._id.toString()
            ].privateChannelId?.toString(),
          avatar: currentUser.avatar,
          username: currentUser.username,
          discriminator: currentUser.discriminator,
        };
      }

      if (friendshipStatus === FriendshipEnum.Blocked) {
        if (userFriendship?.friendshipStatus === FriendshipEnum.Blocked) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to update friend friendship status',
          });
        }

        const currentUserUpdateResult = await collections.users!.updateOne(
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
          const friendUpdateResult = await collections.users!.updateOne(
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

          targetFriendResponse = {
            _id: currentUser._id,
            friendshipStatus: null,
            privateChannelId: targetFriendship.privateChannelId?.toString(),
            avatar: currentUser.avatar,
            username: currentUser.username,
            discriminator: currentUser.discriminator,
          };
        }

        currentUserFriendResponse = {
          _id: targetFriend._id,
          friendshipStatus: FriendshipEnum.Blocked,
          privateChannelId: userFriendship.privateChannelId?.toString(),
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
    }

    emitUpdateFriendshipStatus(currentUser._id, currentUserFriendResponse!);
    if (targetFriendResponse !== null) {
      emitUpdateFriendshipStatus(
        currentUserFriendResponse!._id,
        targetFriendResponse
      );
    }

    if (
      currentUserNewPrivateChannelResponse !== null &&
      targetFriendNewPrivateChannelResponse !== null
    ) {
      emitNewPrivateChannel(
        [currentUser._id],
        currentUserNewPrivateChannelResponse
      );
      emitNewPrivateChannel([friendId!], targetFriendNewPrivateChannelResponse);
    }

    return res
      .status(httpConstants.HTTP_STATUS_OK)
      .json(currentUserFriendResponse!);
  }
);

router.delete(
  '/:username/:discriminator',
  Authorize,
  async (req: DeleteFriendRequest, res: AuthorizedResponse) => {
    const currentUser = res.locals.currentUser;
    const { username, discriminator } = req.params;
    let currentUserFriendResponse: WithId<FriendResponse> | null = null;
    let targetFriendResponse: WithId<FriendResponse> | null = null;
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
      const targetFriend = await collections.users!.findOne({
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
        const friendUpdateResult = await collections.users!.updateOne(
          {
            _id: targetFriend._id,
          },
          {
            $set: {
              [`friends.${currentUser._id.toString()}.friendshipStatus`]: null,
            },
          }
        );

        targetFriendResponse = {
          _id: currentUser._id,
          friendshipStatus: null,
          privateChannelId: targetFriendship.privateChannelId?.toString(),
          avatar: currentUser.avatar,
          username: currentUser.username,
          discriminator: currentUser.discriminator,
        };

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

        const friendUpdateResult = await collections.users!.updateOne(
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

        targetFriendResponse = {
          _id: currentUser._id,
          friendshipStatus: null,
          privateChannelId: targetFriendship.privateChannelId?.toString(),
          avatar: currentUser.avatar,
          username: currentUser.username,
          discriminator: currentUser.discriminator,
        };
      }

      const currentUserUpdateResult = await collections.users!.updateOne(
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

      currentUserFriendResponse = {
        _id: targetFriend._id,
        friendshipStatus: null,
        privateChannelId: userFriendship.privateChannelId?.toString(),
        avatar: targetFriend.avatar,
        username: targetFriend.username,
        discriminator: targetFriend.discriminator,
      };
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    }

    emitUpdateFriendshipStatus(currentUser._id, currentUserFriendResponse!);
    if (targetFriendResponse !== null) {
      emitUpdateFriendshipStatus(
        currentUserFriendResponse!._id,
        targetFriendResponse
      );
    }

    return res.status(httpConstants.HTTP_STATUS_OK).json(returnId);
  }
);

export default router;
