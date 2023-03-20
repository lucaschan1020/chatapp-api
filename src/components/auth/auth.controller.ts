import express from 'express';
import { constants as httpConstants } from 'http2';
import { AuthorizedResponse } from '../../middleware/interfaces/authentication.middleware.interface';
import IAuthController, {
  LoginRequest,
} from './interfaces/auth.controller.interface';
import IAuthService from './interfaces/auth.service.interface';

class AuthController implements IAuthController {
  constructor(private readonly authService: IAuthService) {}

  post = async (req: LoginRequest, res: express.Response) => {
    const { userToken } = req.body;
    const result = await this.authService.register(userToken);
    if (!result.isNew) {
      res.status(httpConstants.HTTP_STATUS_OK).json(result.user);
      return;
    }
    res.status(httpConstants.HTTP_STATUS_CREATED).json(result.user);
    return;
  };

  get = async (req: express.Request, res: AuthorizedResponse) => {
    const result = await this.authService.authenticate(res.locals);
    res.status(httpConstants.HTTP_STATUS_OK).json(result);
    return;
  };
}

export default AuthController;
