import express from 'express';
import { TokenPayload } from 'google-auth-library';
import IUserRepository from '../components/user/interfaces/user.repository.interface';
import { UserDto } from '../infrastructure/database/schema';
import ITokenVerifier from '../infrastructure/oauth/interfaces';
import IAuthenticationMiddleware, {
  AuthorizedResponse,
} from './interfaces/authentication.middleware.interface';
import {
  AppError,
  ErrorType,
} from './interfaces/error-handler.middleware.interface';

class AuthenticationMiddleware implements IAuthenticationMiddleware {
  constructor(
    private readonly tokenVerifier: ITokenVerifier,
    private readonly userRepository: IUserRepository
  ) {}
  Authenticate = async (
    req: express.Request,
    res: AuthorizedResponse,
    next: express.NextFunction
  ) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next(
        new AppError(
          ErrorType.AUTHENTICATION_ERROR,
          'Authorization header not found'
        )
      );
    }
    const bearerFound = authHeader.indexOf('Bearer ');
    if (bearerFound < 0) {
      return next(
        new AppError(
          ErrorType.AUTHENTICATION_ERROR,
          'Authorization token format invalid'
        )
      );
    }
    const token = authHeader.slice(bearerFound + 7);
    if (!token.length) {
      return next(
        new AppError(
          ErrorType.AUTHENTICATION_ERROR,
          'Authorization token format invalid'
        )
      );
    }
    let decodedToken: TokenPayload | undefined = undefined;
    try {
      decodedToken = await this.tokenVerifier.verifyToken(token);
    } catch (e) {
      return next(
        new AppError(
          ErrorType.AUTHENTICATION_ERROR,
          'Invalid token',
          undefined,
          e
        )
      );
    }
    if (!decodedToken) {
      return next(
        new AppError(ErrorType.AUTHENTICATION_ERROR, 'Invalid token')
      );
    }
    let currentUser: UserDto | null = null;
    try {
      currentUser = await this.userRepository.findOne({
        sub: decodedToken.sub,
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
export default AuthenticationMiddleware;
