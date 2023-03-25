import express from 'express';
import authenticationMiddleware from '../../middleware/authentication.middleware-maker';
import { tryCatch } from '../../utilities/common';
import privateChannelController from './private-channel.controller-maker';

const router = express.Router();

router.get(
  '/private/:privateChannelId',
  authenticationMiddleware.Authenticate,
  tryCatch(privateChannelController.get)
);

router.get(
  '/private',
  authenticationMiddleware.Authenticate,
  tryCatch(privateChannelController.getAll)
);

router.post(
  '/private',
  authenticationMiddleware.Authenticate,
  tryCatch(privateChannelController.post)
);

export default router;
