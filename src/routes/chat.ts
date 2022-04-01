import express from 'express';
import { constants as httpConstants } from 'http2';
import { ObjectId } from 'mongodb';
import { collections } from '../database';
import { ChatMessage } from '../database/schema';
import Authorize, {
  AuthorizedResponse,
} from '../middleware/authorization-middleware';
import { emitSendPrivateChannelChat } from '../socketIO';

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

export interface PrivateChannelChatResponse {
  channelId: string;
  bucketId: number;
  chatMessages: {
    timestamp: Date;
    senderId: string;
    content: string | null;
  }[];
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
    let privateChannelChatResponse: PrivateChannelChatResponse;
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
      const privateChannel = await collections.privateChannels!.findOne({
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

      const chatBucketResult = await collections.chatBuckets!.findOne({
        channelId: new ObjectId(privateChannelId),
        bucketId: parseInt(bucketId),
      });

      if (!chatBucketResult) {
        return res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json({
          message: 'Chat bucket not found',
        });
      }

      privateChannelChatResponse = {
        channelId: privateChannelId,
        bucketId: parseInt(bucketId),
        chatMessages: chatBucketResult.chatMessages.map((chatMessage) => ({
          timestamp: chatMessage.timestamp,
          senderId: chatMessage.senderId.toString(),
          content: chatMessage.content,
        })),
      };
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    }

    return res
      .status(httpConstants.HTTP_STATUS_OK)
      .json(privateChannelChatResponse);
  }
);

router.get(
  '/private/:privateChannelId',
  Authorize,
  async (req: GetLatestPrivateChannelChatRequest, res: AuthorizedResponse) => {
    const currentUser = res.locals.currentUser;
    const privateChannelId = req.params.privateChannelId;
    let privateChannelChatResponse: PrivateChannelChatResponse;

    if (!privateChannelId) {
      return res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json({
        message: 'Missing privateChannelId',
      });
    }

    try {
      const privateChannel = await collections.privateChannels!.findOne({
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

      const chatBucketResult = await collections
        .chatBuckets!.find({
          channelId: new ObjectId(privateChannelId),
        })
        .sort({ bucketId: -1 })
        .limit(1)
        .toArray();

      if (chatBucketResult.length === 0) {
        const now = new Date();
        const newChatBucket = await collections.chatBuckets!.insertOne({
          bucketId: 0,
          channelId: new ObjectId(privateChannelId),
          chatMessages: [],
          startDateTime: now,
          endDateTime: now,
        });

        privateChannelChatResponse = {
          channelId: privateChannelId,
          bucketId: 0,
          chatMessages: [],
        };
      } else {
        privateChannelChatResponse = {
          channelId: privateChannelId,
          bucketId: chatBucketResult[0].bucketId,
          chatMessages: chatBucketResult[0].chatMessages.map((chatMessage) => ({
            timestamp: chatMessage.timestamp,
            senderId: chatMessage.senderId.toString(),
            content: chatMessage.content,
          })),
        };
      }
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    }

    return res
      .status(httpConstants.HTTP_STATUS_OK)
      .json(privateChannelChatResponse);
  }
);

router.post(
  '/private/:privateChannelId',
  Authorize,
  async (req: CreatePrivateChannelChatRequest, res: AuthorizedResponse) => {
    const currentUser = res.locals.currentUser;
    const privateChannelId = req.params.privateChannelId;
    const content = req.body.content.trim();
    const now = new Date();
    let privateChannelChatResponse: PrivateChannelChatResponse;
    const newChatMessage: ChatMessage = {
      timestamp: now,
      senderId: currentUser._id,
      content: content,
      lastModified: now,
    };

    try {
      const privateChannel = await collections.privateChannels!.findOne({
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

      const chatBucketResult = await collections
        .chatBuckets!.find({
          channelId: new ObjectId(privateChannelId),
        })
        .sort({ bucketId: -1 })
        .limit(1)
        .toArray();
      let bucketId = 0;
      if (chatBucketResult.length === 0) {
        await collections.chatBuckets!.insertOne({
          bucketId,
          channelId: new ObjectId(privateChannelId),
          chatMessages: [newChatMessage],
          startDateTime: now,
          endDateTime: now,
        });
      } else if (chatBucketResult[0].chatMessages.length > 50) {
        bucketId = chatBucketResult[0].bucketId + 1;
        await collections.chatBuckets!.insertOne({
          bucketId,
          channelId: new ObjectId(privateChannelId),
          chatMessages: [newChatMessage],
          startDateTime: now,
          endDateTime: now,
        });
      } else {
        bucketId = chatBucketResult[0].bucketId;
        const insertNewChatMessage = await collections.chatBuckets!.updateOne(
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

      privateChannelChatResponse = {
        channelId: privateChannelId,
        bucketId,
        chatMessages: [
          {
            timestamp: newChatMessage.timestamp,
            senderId: newChatMessage.senderId.toString(),
            content: newChatMessage.content,
          },
        ],
      };
    } catch (e) {
      console.log(e);
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    }

    emitSendPrivateChannelChat(
      new ObjectId(privateChannelId),
      privateChannelChatResponse
    );

    return res
      .status(httpConstants.HTTP_STATUS_CREATED)
      .json(privateChannelChatResponse);
  }
);

export default router;
