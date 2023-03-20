import express from 'express';
import authenticationMiddleware from '../../middleware/authentication.middleware-maker';
import { tryCatch } from '../../utilities/common';
import friendController from './friend.controller-maker';
const router = express.Router();

router.get(
  '/:username/:discriminator',
  authenticationMiddleware.Authenticate,
  tryCatch(friendController.get)
);

router.get(
  '',
  authenticationMiddleware.Authenticate,
  tryCatch(friendController.getAll)
);

router.post(
  '/:username/:discriminator',
  authenticationMiddleware.Authenticate,
  tryCatch(friendController.post)
);

router.put(
  '/:username/:discriminator',
  authenticationMiddleware.Authenticate,
  tryCatch(friendController.put)
);

router.delete(
  '/:username/:discriminator',
  authenticationMiddleware.Authenticate,
  tryCatch(friendController.delete)
);

export default router;
