import { FriendDto, UserDto } from '../../infrastructure/database/schema';
import ITokenVerifier from '../../infrastructure/oauth/interfaces';
import { AuthorizedLocal } from '../../middleware/interfaces/authentication.middleware.interface';
import { transformUserResponse } from '../../utilities/transform';
import IUserRepository from '../user/interfaces/user.repository.interface';
import IAuthService from './interfaces/auth.service.interface';
import IAuthValidator from './interfaces/auth.validator.interface';

class AuthService implements IAuthService {
  constructor(
    private readonly tokenVerifier: ITokenVerifier,
    private readonly userService: IUserRepository,
    private readonly authValidator: IAuthValidator
  ) {}

  register = async (token: string) => {
    await this.authValidator.validationToken(token);
    const decodedToken = await this.tokenVerifier.verifyToken(token);

    let result: UserDto | null = null;
    result = await this.userService.findOne({ sub: decodedToken.sub });

    if (result) {
      return { user: transformUserResponse(result), isNew: false };
    }

    let toBeDiscriminator: number = 0;
    for (let index = 0; index < 10; index++) {
      toBeDiscriminator = Math.floor(Math.random() * 9999) + 1;

      const found = await this.userService.count(
        { username: decodedToken.name, discriminator: toBeDiscriminator },
        1
      );
      if (found === 0) {
        break;
      }
      toBeDiscriminator = 0;
    }

    if (toBeDiscriminator === 0) {
      throw new Error('Failed to generate discriminator');
    }

    result = await this.userService.insert({
      sub: decodedToken.sub,
      email: decodedToken.email!,
      emailVerified: decodedToken.email_verified!,
      name: decodedToken.name!,
      avatar: decodedToken.picture!,
      givenName: decodedToken.given_name!,
      familyName: decodedToken.family_name!,
      locale: decodedToken.locale!,
      username: decodedToken.name!,
      discriminator: toBeDiscriminator,
      registerTime: new Date(),
      friends: {} as Record<string, FriendDto>,
      joinedGroupPrivateChannels: [],
    });

    if (!result) {
      throw new Error('Failed to find created user');
    }
    return { user: transformUserResponse(result), isNew: true };
  };

  authenticate = (locals: AuthorizedLocal) => {
    return transformUserResponse(locals.currentUser);
  };
}

export default AuthService;
