import UserRepository from '../components/user/user.repository';
import GAPITokenVerifier from '../infrastructure/oauth';
import AuthenticationMiddleware from './authentication.middleware';
import IAuthenticationMiddleware from './interfaces/authentication.middleware.interface';

const authenticationMiddleware: IAuthenticationMiddleware =
  new AuthenticationMiddleware(new GAPITokenVerifier(), new UserRepository());

export default authenticationMiddleware;
