import express from 'express';
import { constants as httpConstants } from 'http2';
import { ObjectId, WithId } from 'mongodb';
import { collections } from '../database';
import {
  Friend,
  FriendshipEnum,
  PrivateChannel,
  UserDTO,
} from '../database/schema';
import Authorize, {
  AuthorizedResponse,
} from '../middleware/authorization-middleware';
import { emitNewPrivateChannel, emitUpdateFriendshipStatus } from '../socketIO';
import isDuplicateExist from '../utilities/isDuplicateExist';
import isValidObjectId from '../utilities/isValidObjectId';
import { arrayToObject } from '../utilities/objectArrayConverter';
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
    let participantResultDTO: WithId<UserDTO>[] = [];

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

        const friendResultModel = await collections.users!.findOne({
          _id: userFriendship.friendId,
        });

        if (!friendResultModel) {
          return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
            message: 'Fail to find participants details',
          });
        }

        // TO DO REFACTOR
        const friendResultDTO: WithId<UserDTO> = {
          _id: friendResultModel._id,
          sub: friendResultModel.sub,
          email: friendResultModel.email,
          emailVerified: friendResultModel.emailVerified,
          name: friendResultModel.name,
          avatar: friendResultModel.avatar,
          givenName: friendResultModel.givenName,
          familyName: friendResultModel.familyName,
          locale: friendResultModel.locale,
          username: friendResultModel.username,
          discriminator: friendResultModel.discriminator,
          registerTime: friendResultModel.registerTime,
          joinedGroupPrivateChannels:
            friendResultModel.joinedGroupPrivateChannels,
          friends: arrayToObject(friendResultModel.friends, 'friendId'),
        };

        participantResultDTO = [friendResultDTO];
      } else {
        const participantResultModel = await collections
          .users!.find({
            joinedGroupPrivateChannels: {
              $in: [new ObjectId(privateChannelId)],
            },
            _id: {
              $ne: currentUser._id,
            },
          })
          .toArray();

        // TO DO REFACTOR
        participantResultDTO = participantResultModel.map((participant) => {
          return {
            _id: participant._id,
            sub: participant.sub,
            email: participant.email,
            emailVerified: participant.emailVerified,
            name: participant.name,
            avatar: participant.avatar,
            givenName: participant.givenName,
            familyName: participant.familyName,
            locale: participant.locale,
            username: participant.username,
            discriminator: participant.discriminator,
            registerTime: participant.registerTime,
            joinedGroupPrivateChannels: participant.joinedGroupPrivateChannels,
            friends: arrayToObject(participant.friends, 'friendId'),
          };
        });
      }
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    }

    const privateChannelResponse: Partial<WithId<PrivateChannelResponse>> = {
      _id: privateChannelResult._id,
      participants: participantResultDTO.map((participant) => ({
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
    let friendResultDTO: WithId<UserDTO>[];
    let groupFriendResultDTO: WithId<UserDTO>[];

    try {
      privateChannelResult = await collections
        .privateChannels!.find({
          _id: {
            $in: [...activePrivateChannelIds, ...joinedGroupPrivateChannels],
          },
        })
        .toArray();

      const friendResultModel = await collections
        .users!.find({
          _id: {
            $in: activeFriendIds,
          },
        })
        .toArray();

      const groupFriendResultModel = await collections
        .users!.find({
          joinedGroupPrivateChannels: {
            $in: joinedGroupPrivateChannels,
          },
          _id: {
            $ne: currentUser._id,
          },
        })
        .toArray();

      // TO DO REFACTOR
      friendResultDTO = friendResultModel.map((friend) => {
        return {
          _id: friend._id,
          sub: friend.sub,
          email: friend.email,
          emailVerified: friend.emailVerified,
          name: friend.name,
          avatar: friend.avatar,
          givenName: friend.givenName,
          familyName: friend.familyName,
          locale: friend.locale,
          username: friend.username,
          discriminator: friend.discriminator,
          registerTime: friend.registerTime,
          joinedGroupPrivateChannels: friend.joinedGroupPrivateChannels,
          friends: arrayToObject(friend.friends, 'friendId'),
        };
      });

      // TO DO REFACTOR
      groupFriendResultDTO = groupFriendResultModel.map((friend) => {
        return {
          _id: friend._id,
          sub: friend.sub,
          email: friend.email,
          emailVerified: friend.emailVerified,
          name: friend.name,
          avatar: friend.avatar,
          givenName: friend.givenName,
          familyName: friend.familyName,
          locale: friend.locale,
          username: friend.username,
          discriminator: friend.discriminator,
          registerTime: friend.registerTime,
          joinedGroupPrivateChannels: friend.joinedGroupPrivateChannels,
          friends: arrayToObject(friend.friends, 'friendId'),
        };
      });
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

    friendResultDTO.forEach((friend) => {
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
      const participants = groupFriendResultDTO
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
    let participantsResultDTO: WithId<UserDTO>[];
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

        const updatedTargetFriendModel =
          await collections.users!.findOneAndUpdate(
            {
              _id: new ObjectId(friendId),
              'friends.friendId': currentUser._id,
            },
            {
              $set: {
                'friends.$.friendId': currentUser._id,
                'friends.$.friendshipStatus': newPrivateChannel.insertedId,
              },
            },
            {
              returnDocument: 'after',
            }
          );

        const updatedCurrentUserModel =
          await collections.users!.findOneAndUpdate(
            { _id: currentUser._id, 'friends.friendId': friendId },
            {
              $set: {
                'friends.$.friendId': new ObjectId(friendId),
                'friends.$.friendshipStatus': newPrivateChannel.insertedId,
                'friends.$.active': true,
              },
            },
            {
              returnDocument: 'after',
            }
          );

        // TO DO REFACTOR
        const updatedTargetFriendDTO: WithId<UserDTO> = {
          _id: updatedTargetFriendModel.value!._id,
          sub: updatedTargetFriendModel.value!.sub,
          email: updatedTargetFriendModel.value!.email,
          emailVerified: updatedTargetFriendModel.value!.emailVerified,
          name: updatedTargetFriendModel.value!.name,
          avatar: updatedTargetFriendModel.value!.avatar,
          givenName: updatedTargetFriendModel.value!.givenName,
          familyName: updatedTargetFriendModel.value!.familyName,
          locale: updatedTargetFriendModel.value!.locale,
          username: updatedTargetFriendModel.value!.username,
          discriminator: updatedTargetFriendModel.value!.discriminator,
          registerTime: updatedTargetFriendModel.value!.registerTime,
          joinedGroupPrivateChannels:
            updatedTargetFriendModel.value!.joinedGroupPrivateChannels,
          friends: arrayToObject(
            updatedTargetFriendModel.value!.friends,
            'friendId'
          ),
        };

        // TO DO REFACTOR
        const updatedCurrentUserDTO: WithId<UserDTO> = {
          _id: updatedCurrentUserModel.value!._id,
          sub: updatedCurrentUserModel.value!.sub,
          email: updatedCurrentUserModel.value!.email,
          emailVerified: updatedCurrentUserModel.value!.emailVerified,
          name: updatedCurrentUserModel.value!.name,
          avatar: updatedCurrentUserModel.value!.avatar,
          givenName: updatedCurrentUserModel.value!.givenName,
          familyName: updatedCurrentUserModel.value!.familyName,
          locale: updatedCurrentUserModel.value!.locale,
          username: updatedCurrentUserModel.value!.username,
          discriminator: updatedCurrentUserModel.value!.discriminator,
          registerTime: updatedCurrentUserModel.value!.registerTime,
          joinedGroupPrivateChannels:
            updatedCurrentUserModel.value!.joinedGroupPrivateChannels,
          friends: arrayToObject(
            updatedCurrentUserModel.value!.friends,
            'friendId'
          ),
        };

        currentUserFriendResponse = {
          _id: new ObjectId(friendId),
          friendshipStatus:
            updatedCurrentUserDTO.friends[friendId].friendshipStatus ?? null,
          privateChannelId:
            updatedCurrentUserDTO.friends[
              friendId
            ].privateChannelId?.toString(),
          avatar: updatedCurrentUserDTO.avatar,
          username: updatedCurrentUserDTO.username,
          discriminator: updatedCurrentUserDTO.discriminator,
        };

        targetFriendResponse = {
          _id: currentUser._id,
          friendshipStatus:
            updatedTargetFriendDTO.friends[currentUser._id.toString()]
              .friendshipStatus ?? null,
          privateChannelId:
            updatedTargetFriendDTO.friends[
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

      const participantsResultModel = await collections
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

      // TO DO REFACTOR
      participantsResultDTO = participantsResultModel.map((participant) => {
        return {
          _id: participant._id,
          sub: participant.sub,
          email: participant.email,
          emailVerified: participant.emailVerified,
          name: participant.name,
          avatar: participant.avatar,
          givenName: participant.givenName,
          familyName: participant.familyName,
          locale: participant.locale,
          username: participant.username,
          discriminator: participant.discriminator,
          registerTime: participant.registerTime,
          joinedGroupPrivateChannels: participant.joinedGroupPrivateChannels,
          friends: arrayToObject(participant.friends, 'friendId'),
        };
      });
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    }

    const privateChannelResponse: WithId<PrivateChannelResponse> = {
      _id: privateChannelResult._id,
      participants: participantsResultDTO.map((participant) => ({
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
      participantsResultDTO.map((participant) => participant._id),
      privateChannelResponse
    );

    return res
      .status(httpConstants.HTTP_STATUS_CREATED)
      .json(privateChannelResponse);
  }
);

export default router;
