import express from 'express';
import { constants as httpConstants } from 'http2';
import { ObjectId, WithId } from 'mongodb';
import mongoClient from '../database';
import { ChatBucket, PrivateChannel } from '../database/schema';
import Authorize, {
  AuthorizedResponse,
} from '../middleware/authorization-middleware';

const router = express.Router();
interface GetLatestPrivateChannelChatRequest extends express.Request {
  params: {
    privateChannelId: string;
  };
}

interface GetSpecificPrivateChannelChatRequest extends express.Request {
  params: {
    privateChannelId: string;
    bucketId: string;
  };
}

router.get(
  '/private/:privateChannelId/:bucketId',
  Authorize,
  async (
    req: GetSpecificPrivateChannelChatRequest,
    res: AuthorizedResponse
  ) => {
    const currentUser = res.locals.currentUser;
    const { privateChannelId, bucketId } = req.params;
    let chatBucket: WithId<ChatBucket> | null;

    if (!privateChannelId) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Missing privateChannelId',
      });
    }

    if (!bucketId) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Missing bucketId',
      });
    }

    if (isNaN(bucketId as any)) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'bucketId must be integer',
      });
    }

    try {
      await mongoClient.connect();
      const privateChannelCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<PrivateChannel>('privateChannels');

      const chatBucketCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<ChatBucket>('chatBuckets');

      const privateChannel = await privateChannelCollection.findOne({
        _id: new ObjectId(privateChannelId),
      });

      if (!privateChannel) {
        return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
          message: 'Private channel not found',
        });
      }

      const isJoined = privateChannel.isGroup
        ? currentUser.joinedGroupPrivateChannels.some((groupPrivateChannel) =>
            groupPrivateChannel.equals(privateChannelId)
          )
        : Object.values(currentUser.friends).some((friend) =>
            friend.privateChannelId.equals(privateChannelId)
          );

      if (!isJoined) {
        return res.status(httpConstants.HTTP_STATUS_UNAUTHORIZED).json({
          message: 'User is not participant of this private channel',
        });
      }

      chatBucket = await chatBucketCollection.findOne({
        channelId: new ObjectId(privateChannelId),
        bucketId: parseInt(bucketId),
      });

      if (!chatBucket) {
        return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
          message: 'Chat bucket not found',
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

    return res.status(httpConstants.HTTP_STATUS_OK).json(chatBucket);
  }
);

router.get(
  '/private/:privateChannelId',
  Authorize,
  async (req: GetLatestPrivateChannelChatRequest, res: AuthorizedResponse) => {
    const currentUser = res.locals.currentUser;
    const privateChannelId = req.params.privateChannelId;
    let chatBucket: WithId<ChatBucket>;

    if (!privateChannelId) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Missing privateChannelId',
      });
    }

    try {
      await mongoClient.connect();
      const privateChannelCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<PrivateChannel>('privateChannels');

      const chatBucketCollection = await mongoClient
        .db(process.env.MONGODBNAME)
        .collection<ChatBucket>('chatBuckets');

      const privateChannel = await privateChannelCollection.findOne({
        _id: new ObjectId(privateChannelId),
      });

      if (!privateChannel) {
        return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
          message: 'Private channel not found',
        });
      }

      const isJoined = privateChannel.isGroup
        ? currentUser.joinedGroupPrivateChannels.some((groupPrivateChannel) =>
            groupPrivateChannel.equals(privateChannelId)
          )
        : Object.values(currentUser.friends).some((friend) =>
            friend.privateChannelId.equals(privateChannelId)
          );

      if (!isJoined) {
        return res.status(httpConstants.HTTP_STATUS_UNAUTHORIZED).json({
          message: 'User is not participant of this private channel',
        });
      }

      const result = await chatBucketCollection
        .find({
          channelId: new ObjectId(privateChannelId),
        })
        .sort({ bucket: -1 })
        .limit(1)
        .toArray();

      if (result.length === 0) {
        const now = new Date();
        const newChatBucket = await chatBucketCollection.insertOne({
          bucketId: 0,
          channelId: new ObjectId(privateChannelId),
          chatMessages: [],
          startDateTime: now,
          endDateTime: now,
        });

        chatBucket = {
          _id: newChatBucket.insertedId,
          bucketId: 0,
          channelId: new ObjectId(privateChannelId),
          chatMessages: [],
          startDateTime: now,
          endDateTime: now,
        };
      } else {
        chatBucket = result[0];
      }
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    } finally {
      await mongoClient.close();
    }

    return res.status(httpConstants.HTTP_STATUS_OK).json(chatBucket);
  }
);
