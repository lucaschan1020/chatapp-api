import express from 'express';
import authenticationMiddleware from '../../middleware/authentication.middleware-maker';
import { tryCatch } from '../../utilities/common';
import chatController from './chat.controller-maker';

const router = express.Router();

router.get(
  '/private/:privateChannelId/:bucketId',
  authenticationMiddleware.Authenticate,
  tryCatch(chatController.get)
);

router.get(
  '/private/:privateChannelId',
  authenticationMiddleware.Authenticate,
  tryCatch(chatController.getLatest)
);

router.post(
  '/private/:privateChannelId',
  authenticationMiddleware.Authenticate,
  tryCatch(chatController.post)
);

export default router;
