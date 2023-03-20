import express from 'express';
import { UserDto } from '../../infrastructure/database/schema';

type AuthorizedLocal = { currentUser: UserDto };
type AuthorizedResponse = express.Response<any, AuthorizedLocal>;

interface IAuthenticationMiddleware {
  Authenticate(
    req: express.Request,
    res: AuthorizedResponse,
    next: express.NextFunction
  ): Promise<void>;
}

export { AuthorizedLocal, AuthorizedResponse };
export default IAuthenticationMiddleware;
