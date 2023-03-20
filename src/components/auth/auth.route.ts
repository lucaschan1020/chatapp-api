import express from 'express';
import authenticationMiddleware from '../../middleware/authentication.middleware-maker';
import { tryCatch } from '../../utilities/common';
import authController from './auth.controller-maker';

const router = express.Router();

router.post('/login', tryCatch(authController.post));

router.get(
  '/login',
  authenticationMiddleware.Authenticate,
  tryCatch(authController.get)
);

export default router;
