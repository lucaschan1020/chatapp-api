import express from 'express';
import { constants as httpConstants } from 'http2';
import { ObjectId, WithId } from 'mongodb';
import mongoClient from '../database';
import { FriendshipEnum, PrivateChannel, User } from '../database/schema';
import Authorize, {
  AuthorizedResponse,
} from '../middleware/authorization-middleware';

const router = express.Router();

interface PrivateChannelResponse {
  participants: {
    friendshipStatus?: FriendshipEnum | null;
    avatar: string;
    username: string;
    discriminator: number;
  }[];
  privateChannelName: string;
  dateCreated: Date;
  isGroup: boolean;
}

interface CreatePrivateChannelRequest extends express.Request {
  body: {
    participants: string[];
    privateChannelName: string;
  };
}

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
      await mongoClient.connect();
      const userCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<User>('users');
      const privateChannelCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<PrivateChannel>('privateChannels');

      privateChannelResult = await privateChannelCollection
        .find({
          _id: {
            $in: [...activePrivateChannelIds, ...joinedGroupPrivateChannels],
          },
        })
        .toArray();

      friendResult = await userCollection
        .find({
          _id: { $in: activeFriendIds },
        })
        .toArray();

      groupFriendResult = await userCollection
        .find({
          joinedGroupPrivateChannels: {
            $in: joinedGroupPrivateChannels,
          },
        })
        .toArray();
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    } finally {
      await mongoClient.close();
    }

    let privateChannelList = {} as Record<
      string,
      Partial<WithId<PrivateChannelResponse>>
    >;

    privateChannelResult.forEach(
      ({ _id, privateChannelName, dateCreated, isGroup }) =>
        (privateChannelList[_id.toString()] = {
          _id,
          privateChannelName,
          dateCreated,
          isGroup,
        })
    );

    friendResult.forEach(
      ({ _id, avatar, username, discriminator, friends }) => {
        const friendship = friends[currentUser._id.toString()];
        privateChannelList[friendship.privateChannelId!.toString()] = {
          ...privateChannelList[friendship.privateChannelId!.toString()],
          participants: [
            {
              friendshipStatus: friends[_id.toString()].friendshipStatus,
              avatar,
              username,
              discriminator,
            },
          ],
        };
      }
    );

    joinedGroupPrivateChannels.forEach((privateChannel) => {
      const participants = groupFriendResult
        .filter(({ joinedGroupPrivateChannels }) =>
          joinedGroupPrivateChannels.some((friendPrivateChannel) =>
            friendPrivateChannel.equals(privateChannel)
          )
        )
        .map(({ _id, avatar, username, discriminator }) => ({
          friendshipStatus: friends[_id.toString()].friendshipStatus,
          avatar,
          username,
          discriminator,
        }));

      privateChannelList[privateChannel.toString()] = {
        ...privateChannelList[privateChannel.toString()],
        participants,
      };
    });

    return res
      .status(httpConstants.HTTP_STATUS_OK)
      .json(Object.values(privateChannelList));
  }
);

router.post(
  '/private',
  Authorize,
  async (req: CreatePrivateChannelRequest, res: AuthorizedResponse) => {
    const currentUser = res.locals.currentUser;
    const { participants, privateChannelName } = req.body;
    let privateChannelResult: WithId<PrivateChannel> | null;
    let friendResult: WithId<User>[];

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

    const isGroup = participants.length > 1;
    const notFriends = participants.some((participant) => {
      if (currentUser.friends[participant] === undefined) return false;
      return (
        currentUser.friends[participant].friendshipStatus !==
        FriendshipEnum.Friend
      );
    });

    if (isGroup && notFriends) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Members must be friend when creating group private channel',
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
      await mongoClient.connect();
      const userCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<User>('users');
      const privateChannelCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<PrivateChannel>('privateChannels');

      const newPrivateChannel = await privateChannelCollection.insertOne({
        privateChannelName: isGroup ? privateChannelName : '',
        dateCreated: new Date(),
        isGroup: isGroup,
      });

      if (!isGroup) {
        const friendId = participants[0];

        await userCollection.findOneAndUpdate({ _id: new ObjectId(friendId) }, [
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
        ]);

        await userCollection.findOneAndUpdate({ _id: currentUser._id }, [
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
        ]);
      } else {
        await userCollection.updateMany(
          {
            _id: {
              $in: participants.map((particant) => new ObjectId(particant)),
            },
          },
          {
            $addToSet: {
              joinedGroupPrivateChannels: newPrivateChannel.insertedId,
            },
          }
        );
      }

      friendResult = await userCollection
        .find({
          _id: {
            $in: [
              ...participants.map((participant) => new ObjectId(participant)),
              currentUser._id,
            ],
          },
        })
        .toArray();

      privateChannelResult = await privateChannelCollection.findOne({
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
    } finally {
      await mongoClient.close();
    }
    const privateChannelResponse: WithId<PrivateChannelResponse> = {
      _id: privateChannelResult._id,
      participants: friendResult.map(
        ({ _id, avatar, username, discriminator }) => ({
          friendshipStatus:
            currentUser.friends[_id.toString()].friendshipStatus,
          avatar,
          username,
          discriminator,
        })
      ),
      privateChannelName: privateChannelResult.privateChannelName,
      dateCreated: privateChannelResult.dateCreated,
      isGroup: privateChannelResult.isGroup,
    };

    return res
      .status(httpConstants.HTTP_STATUS_OK)
      .json(privateChannelResponse);
  }
);

export default router;
