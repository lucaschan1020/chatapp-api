import express from 'express';
import { constants as httpConstants } from 'http2';
import { WithId } from 'mongodb';
import mongoClient from '../database';
import { FriendshipEnum, PrivateChannel, User } from '../database/schema';
import Authorize, {
  AuthorizedResponse,
} from '../middleware/authorization-middleware';

const router = express.Router();

interface PrivateChannelDetail {
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

router.get(
  '',
  Authorize,
  async (req: express.Request, res: AuthorizedResponse) => {
    const currentUser = res.locals.currentUser;
    const { friends, joinedGroupPrivateChannels } = res.locals.currentUser;

    const activePrivateChannels = Object.values(friends).filter((friend) => {
      if (friend.active === undefined) return false;
      return friend.active;
    });

    const activeFriendIds = activePrivateChannels.map(
      (friend) => friend.friendId
    );

    const activePrivateChannelIds = activePrivateChannels.map(
      (friend) => friend.privateChannelId
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
      Partial<WithId<PrivateChannelDetail>>
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
        privateChannelList[friendship.privateChannelId.toString()] = {
          ...privateChannelList[friendship.privateChannelId.toString()],
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

export default router;
