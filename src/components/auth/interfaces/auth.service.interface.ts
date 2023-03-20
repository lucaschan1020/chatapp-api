import { AuthorizedLocal } from '../../../middleware/interfaces/authentication.middleware.interface';

interface UserResponse {
  id: string;
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatar: string;
  givenName: string;
  familyName: string;
  locale: string;
  username: string;
  discriminator: number;
}

interface IAuthService {
  register(token: string): Promise<{ user: UserResponse; isNew: boolean }>;

  authenticate(locals: AuthorizedLocal): UserResponse;
}

export { UserResponse };
export default IAuthService;
