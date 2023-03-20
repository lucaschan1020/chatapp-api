import GAPITokenVerifier from '../../infrastructure/oauth';
import UserRepository from '../user/user.repository';
import AuthService from './auth.service';
import AuthValidator from './auth.validator';
import IAuthService from './interfaces/auth.service.interface';

const authService: IAuthService = new AuthService(
  new GAPITokenVerifier(),
  new UserRepository(),
  new AuthValidator()
);

export default authService;
