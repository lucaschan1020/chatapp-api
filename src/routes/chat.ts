import express from 'express';
import { constants as httpConstants } from 'http2';
import { ObjectId, WithId } from 'mongodb';
import mongoClient from '../database';
import { ChatBucket, ChatMessage, PrivateChannel } from '../database/schema';
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

interface CreatePrivateChannelChatRequest extends express.Request {
  params: {
    privateChannelId: string;
  };
  body: {
    content: string;
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
            friend.privateChannelId?.equals(privateChannelId)
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
            friend.privateChannelId?.equals(privateChannelId)
          );

      if (!isJoined) {
        return res.status(httpConstants.HTTP_STATUS_UNAUTHORIZED).json({
          message: 'User is not participant of this private channel',
        });
      }

      const chatBucketResult = await chatBucketCollection
        .find({
          channelId: new ObjectId(privateChannelId),
        })
        .sort({ bucketId: -1 })
        .limit(1)
        .toArray();

      if (chatBucketResult.length === 0) {
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
        chatBucket = {
          _id: chatBucketResult[0]._id,
          bucketId: chatBucketResult[0].bucketId,
          channelId: chatBucketResult[0].channelId,
          chatMessages: chatBucketResult[0].chatMessages,
          startDateTime: chatBucketResult[0].startDateTime,
          endDateTime: chatBucketResult[0].endDateTime,
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

    return res.status(httpConstants.HTTP_STATUS_OK).json(chatBucket);
  }
);

router.post(
  '/private/:privateChannelId',
  Authorize,
  async (req: CreatePrivateChannelChatRequest, res: AuthorizedResponse) => {
    const currentUser = res.locals.currentUser;
    const privateChannelId = req.params.privateChannelId;
    const content = req.body.content;
    const now = new Date();
    const newChatMessage: ChatMessage = {
      timestamp: now,
      senderId: new ObjectId(currentUser._id),
      content: content,
      lastModified: now,
    };

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
            friend.privateChannelId?.equals(privateChannelId)
          );

      if (!isJoined) {
        return res.status(httpConstants.HTTP_STATUS_UNAUTHORIZED).json({
          message: 'User is not participant of this private channel',
        });
      }

      const chatBucketResult = await chatBucketCollection
        .find({
          channelId: new ObjectId(privateChannelId),
        })
        .sort({ bucketId: -1 })
        .limit(1)
        .toArray();

      if (chatBucketResult.length === 0) {
        await chatBucketCollection.insertOne({
          bucketId: 0,
          channelId: new ObjectId(privateChannelId),
          chatMessages: [newChatMessage],
          startDateTime: now,
          endDateTime: now,
        });
      } else if (chatBucketResult[0].chatMessages.length > 50) {
        await chatBucketCollection.insertOne({
          bucketId: chatBucketResult[0].bucketId + 1,
          channelId: new ObjectId(privateChannelId),
          chatMessages: [newChatMessage],
          startDateTime: now,
          endDateTime: now,
        });
      } else {
        const insertNewChatMessage = await chatBucketCollection.updateOne(
          {
            _id: chatBucketResult[0]._id,
          },
          {
            $push: { chatMessages: newChatMessage },
            $set: { endDateTime: now },
          }
        );

        if (insertNewChatMessage.modifiedCount === 0) {
          return res.status(httpConstants.HTTP_STATUS_CONFLICT).json({
            message: 'Failed to insert new message into chat',
          });
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
    return res.status(httpConstants.HTTP_STATUS_CREATED).json(newChatMessage);
  }
);

export default router;
