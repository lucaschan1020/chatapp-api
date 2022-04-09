import express from 'express';
import { constants as httpConstants } from 'http2';
import { ObjectId, WithId } from 'mongodb';
import { collections } from '../database';
import {
  Friend,
  FriendshipEnum,
  PrivateChannel,
  User,
} from '../database/schema';
import Authorize, {
  AuthorizedResponse,
} from '../middleware/authorization-middleware';
import { emitNewPrivateChannel, emitUpdateFriendshipStatus } from '../socketIO';
import isDuplicateExist from '../utilities/isDuplicateExist';
import isValidObjectId from '../utilities/isValidObjectId';
import { FriendResponse } from './friend';

const router = express.Router();

export interface PrivateChannelResponse {
  participants: {
    _id: string;
    avatar: string;
    username: string;
    discriminator: number;
  }[];
  privateChannelName: string;
  dateCreated: Date;
  isGroup: boolean;
}

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

router.get(
  '/private/:privateChannelId',
  Authorize,
  async (req: GetSpecificPrivateChannelRequest, res: AuthorizedResponse) => {
    const currentUser = res.locals.currentUser;
    const privateChannelId = req.params.privateChannelId;
    let privateChannelResult: WithId<PrivateChannel> | null = null;
    let participantResult: WithId<User>[] = [];

    if (!privateChannelId) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Missing privateChannelId',
      });
    }

    if (!isValidObjectId(privateChannelId)) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'The format of privateChannelId is not valid',
      });
    }

    try {
      privateChannelResult = await collections.privateChannels!.findOne({
        _id: new ObjectId(privateChannelId),
      });

      if (!privateChannelResult) {
        return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
          message: 'Private channel not found',
        });
      }

      const { isGroup } = privateChannelResult;
      let userFriendship: Friend | undefined;
      if (!isGroup) {
        userFriendship = Object.values(currentUser.friends).find((friend) =>
          friend.privateChannelId?.equals(privateChannelId)
        );
      }

      const isJoined = isGroup
        ? currentUser.joinedGroupPrivateChannels.some((groupPrivateChannel) =>
            groupPrivateChannel.equals(privateChannelId)
          )
        : userFriendship !== undefined;

      if (!isJoined) {
        return res.status(httpConstants.HTTP_STATUS_UNAUTHORIZED).json({
          message: 'User is not participant of this private channel',
        });
      }

      if (!isGroup) {
        if (!userFriendship) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to insert new message into chat',
          });
        }

        const friendResult = await collections.users!.findOne({
          _id: userFriendship.friendId,
        });

        if (!friendResult) {
          return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
            message: 'Fail to find participants details',
          });
        }

        participantResult = [friendResult];
      } else {
        participantResult = await collections
          .users!.find({
            joinedGroupPrivateChannels: {
              $in: new ObjectId(privateChannelId),
            },
            _id: {
              $ne: currentUser._id,
            },
          })
          .toArray();
      }
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    }

    const privateChannelResponse: Partial<WithId<PrivateChannelResponse>> = {
      _id: privateChannelResult._id,
      participants: participantResult.map((participant) => ({
        _id: participant._id.toString(),
        avatar: participant.avatar,
        username: participant.username,
        discriminator: participant.discriminator,
      })),
      privateChannelName: privateChannelResult.privateChannelName,
      dateCreated: privateChannelResult.dateCreated,
      isGroup: privateChannelResult.isGroup,
    };

    return res
      .status(httpConstants.HTTP_STATUS_OK)
      .json(privateChannelResponse);
  }
);

router.get(
  '',
  Authorize,
  async (req: express.Request, res: AuthorizedResponse) => {
    const currentUser = res.locals.currentUser;
    const { friends, joinedGroupPrivateChannels } = res.locals.currentUser;

    const activePrivateChannels = Object.values(friends).filter((friend) => {
      if (friend.privateChannelId === undefined || friend.active === undefined)
        return false;
      return friend.active;
    });

    const activeFriendIds = activePrivateChannels.map(
      (friend) => friend.friendId
    );

    const activePrivateChannelIds = activePrivateChannels.map(
      (friend) => friend.privateChannelId!
    );

    let privateChannelResult: WithId<PrivateChannel>[];
    let friendResult: WithId<User>[];
    let groupFriendResult: WithId<User>[];

    try {
      privateChannelResult = await collections
        .privateChannels!.find({
          _id: {
            $in: [...activePrivateChannelIds, ...joinedGroupPrivateChannels],
          },
        })
        .toArray();

      friendResult = await collections
        .users!.find({
          _id: {
            $in: activeFriendIds,
          },
        })
        .toArray();

      groupFriendResult = await collections
        .users!.find({
          joinedGroupPrivateChannels: {
            $in: joinedGroupPrivateChannels,
          },
          _id: {
            $ne: currentUser._id,
          },
        })
        .toArray();
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    }

    let privateChannelResponse = {} as Record<
      string,
      Partial<WithId<PrivateChannelResponse>>
    >;

    privateChannelResult.forEach(
      (privateChannel) =>
        (privateChannelResponse[privateChannel._id.toString()] = {
          _id: privateChannel._id,
          privateChannelName: privateChannel.privateChannelName,
          dateCreated: privateChannel.dateCreated,
          isGroup: privateChannel.isGroup,
        })
    );

    friendResult.forEach((friend) => {
      const friendship = friends[friend._id.toString()];
      privateChannelResponse[friendship.privateChannelId!.toString()] = {
        ...privateChannelResponse[friendship.privateChannelId!.toString()],
        participants: [
          {
            _id: friend._id.toString(),
            avatar: friend.avatar,
            username: friend.username,
            discriminator: friend.discriminator,
          },
        ],
      };
    });

    joinedGroupPrivateChannels.forEach((privateChannel) => {
      const participants = groupFriendResult
        .filter(({ joinedGroupPrivateChannels }) =>
          joinedGroupPrivateChannels.some((friendPrivateChannel) =>
            friendPrivateChannel.equals(privateChannel)
          )
        )
        .map((participant) => ({
          _id: participant._id.toString(),
          avatar: participant.avatar,
          username: participant.username,
          discriminator: participant.discriminator,
        }));

      privateChannelResponse[privateChannel.toString()] = {
        ...privateChannelResponse[privateChannel.toString()],
        participants,
      };
    });

    return res
      .status(httpConstants.HTTP_STATUS_OK)
      .json(privateChannelResponse);
  }
);

router.post(
  '',
  Authorize,
  async (req: CreatePrivateChannelRequest, res: AuthorizedResponse) => {
    const currentUser = res.locals.currentUser;
    const { participants, privateChannelName = '' } = req.body;
    let privateChannelResult: WithId<PrivateChannel> | null;
    let participantsResult: WithId<User>[];
    let currentUserFriendResponse: WithId<FriendResponse> | null = null;
    let targetFriendResponse: WithId<FriendResponse> | null = null;
    if (!participants) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Missing participants',
      });
    }

    if (!Array.isArray(participants)) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Partcipants must be array',
      });
    }

    if (participants.length === 0 || participants.length > 10) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Partcipants must be more than 0 and less than 11 members',
      });
    }
    const isDuplicate = isDuplicateExist(participants);

    if (isDuplicate) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Participants cannot contains duplicate',
      });
    }

    const isValidObjectIdFormat = participants.every((participant) =>
      isValidObjectId(participant)
    );

    if (!isValidObjectIdFormat) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'The format of participants is not valid',
      });
    }

    const isContainsSelf = participants.some((participant) =>
      currentUser._id.equals(participant)
    );

    if (isContainsSelf) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Partcipants cannot include yourself',
      });
    }

    const isGroup = participants.length > 1;
    const notFriends = participants.some((participant) => {
      if (currentUser.friends[participant] === undefined) return true;
      return (
        currentUser.friends[participant].friendshipStatus !==
        FriendshipEnum.Friend
      );
    });

    if (isGroup && notFriends) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message:
          'All participants must be friend when creating group private channel',
      });
    }

    if (
      !isGroup &&
      currentUser.friends[participants[0]]?.privateChannelId !== undefined
    ) {
      return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
        message: 'Private channel with this friend already exist',
      });
    }

    try {
      const participantCount = await collections.users!.countDocuments({
        _id: {
          $in: participants.map((participant) => new ObjectId(participant)),
        },
      });

      if (participantCount !== participants.length) {
        return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
          message: 'One or more participants do not exist',
        });
      }

      const newPrivateChannel = await collections.privateChannels!.insertOne({
        privateChannelName: isGroup ? privateChannelName.trim() : '',
        dateCreated: new Date(),
        isGroup: isGroup,
      });

      if (!isGroup) {
        const friendId = participants[0];

        const updatedTargetFriend = await collections.users!.findOneAndUpdate(
          { _id: new ObjectId(friendId) },
          [
            {
              $set: {
                [`friends.${currentUser._id.toString()}.privateChannelId`]:
                  newPrivateChannel.insertedId,
                [`friends.${currentUser._id.toString()}.friendId`]:
                  currentUser._id,
                [`friends.${currentUser._id.toString()}.friendshipStatus`]: {
                  $cond: [
                    {
                      $not: [
                        `$friends.${currentUser._id.toString()}.friendshipStatus`,
                      ],
                    },
                    null,
                    `$friends.${currentUser._id.toString()}.friendshipStatus`,
                  ],
                },
              },
            },
          ],
          {
            returnDocument: 'after',
          }
        );

        const updatedCurrentUser = await collections.users!.findOneAndUpdate(
          { _id: currentUser._id },
          [
            {
              $set: {
                [`friends.${friendId}.privateChannelId`]:
                  newPrivateChannel.insertedId,
                [`friends.${friendId}.friendId`]: new ObjectId(friendId),
                [`friends.${friendId}.friendshipStatus`]: {
                  $cond: [
                    {
                      $not: [`$friends.${friendId}.friendshipStatus`],
                    },
                    null,
                    `$friends.${friendId}.friendshipStatus`,
                  ],
                },
                [`friends.${friendId}.active`]: true,
              },
            },
          ],
          {
            returnDocument: 'after',
          }
        );

        currentUserFriendResponse = {
          _id: new ObjectId(friendId),
          friendshipStatus:
            updatedCurrentUser.value!.friends[friendId].friendshipStatus ??
            null,
          privateChannelId:
            updatedCurrentUser.value!.friends[
              friendId
            ].privateChannelId?.toString(),
          avatar: updatedTargetFriend.value!.avatar,
          username: updatedTargetFriend.value!.username,
          discriminator: updatedTargetFriend.value!.discriminator,
        };

        targetFriendResponse = {
          _id: currentUser._id,
          friendshipStatus:
            updatedTargetFriend.value!.friends[currentUser._id.toString()]
              .friendshipStatus ?? null,
          privateChannelId:
            updatedTargetFriend.value!.friends[
              currentUser._id.toString()
            ].privateChannelId?.toString(),
          avatar: currentUser.avatar,
          username: currentUser.username,
          discriminator: currentUser.discriminator,
        };
      } else {
        await collections.users!.updateMany(
          {
            _id: {
              $in: [
                ...participants.map((participant) => new ObjectId(participant)),
                currentUser._id,
              ],
            },
          },
          {
            $addToSet: {
              joinedGroupPrivateChannels: newPrivateChannel.insertedId,
            },
          }
        );
      }

      participantsResult = await collections
        .users!.find({
          _id: {
            $in: [
              ...participants.map((participant) => new ObjectId(participant)),
              currentUser._id,
            ],
          },
        })
        .toArray();

      privateChannelResult = await collections.privateChannels!.findOne({
        _id: newPrivateChannel.insertedId,
      });

      if (!privateChannelResult) {
        return res
          .status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR)
          .json({
            message: 'Something went wrong',
          });
      }
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    }

    const privateChannelResponse: WithId<PrivateChannelResponse> = {
      _id: privateChannelResult._id,
      participants: participantsResult.map((participant) => ({
        _id: participant._id.toString(),
        avatar: participant.avatar,
        username: participant.username,
        discriminator: participant.discriminator,
      })),
      privateChannelName: privateChannelResult.privateChannelName,
      dateCreated: privateChannelResult.dateCreated,
      isGroup: privateChannelResult.isGroup,
    };

    if (!isGroup && currentUserFriendResponse !== null) {
      emitUpdateFriendshipStatus(currentUser._id, currentUserFriendResponse);
      emitUpdateFriendshipStatus(
        currentUserFriendResponse._id,
        targetFriendResponse!
      );
    }

    emitNewPrivateChannel(
      participantsResult.map((participant) => participant._id),
      privateChannelResponse
    );

    return res
      .status(httpConstants.HTTP_STATUS_CREATED)
      .json(privateChannelResponse);
  }
);

export default router;
