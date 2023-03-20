import express from 'express';
import IUserRepository from '../components/user/interfaces/user.repository.interface';
import { UserDto } from '../infrastructure/database/schema';
import IAuthenticationMiddleware, {
  AuthorizedResponse,
} from './interfaces/authentication.middleware.interface';
import {
  AppError,
  ErrorType,
} from './interfaces/error-handler.middleware.interface';

class AuthenticateMiddlewareDebug implements IAuthenticationMiddleware {
  constructor(private readonly userRepository: IUserRepository) {
    console.log(
      'Loading Authenticate Middleware in debug mode...please do not use this in production'
    );
  }

  Authenticate = async (
    req: express.Request,
    res: AuthorizedResponse,
    next: express.NextFunction
  ) => {
    const email = req.headers.email as string;

    let currentUser: UserDto | null = null;
    try {
      currentUser = await this.userRepository.findOne({
        email,
      });
    } catch (e) {
      next(e);
    }

    if (!currentUser) {
      return next(
        new AppError(ErrorType.AUTHORIZATION_ERROR, 'User forbidden')
      );
    }

    res.locals.currentUser = currentUser;
    next();
  };
}

export default AuthenticateMiddlewareDebug;
