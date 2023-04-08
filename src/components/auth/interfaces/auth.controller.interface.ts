import express from 'express';
import { AuthorizedResponse } from '../../../middleware/interfaces/authentication.middleware.interface';

interface LoginRequest extends express.Request {
  body: { userToken: string };
}

interface IAuthController {
  post(req: LoginRequest, res: express.Response): Promise<void>;
  get(req: express.Request, res: AuthorizedResponse): Promise<void>;
}

export { LoginRequest };
export default IAuthController;
