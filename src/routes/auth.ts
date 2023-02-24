import 'dotenv/config';
import express from 'express';
import { TokenPayload } from 'google-auth-library';
import { constants as httpConstants } from 'http2';
import { InsertOneResult, WithId } from 'mongodb';
import gapiVerifyToken from '../auth';
import { collections } from '../database';
import { UserDTO, UserModel } from '../database/schema';
import Authorize, {
  AuthorizedResponse,
} from '../middleware/authorization-middleware';
import { arrayToObject } from '../utilities/objectArrayConverter';

const router = express.Router();

interface LoginRequest extends express.Request {
  body: { userToken: string };
}

router.post('/login', async (req: LoginRequest, res: express.Response) => {
  const token = req.body.userToken;
  let decodedToken: TokenPayload | undefined = undefined;
  try {
    decodedToken = await gapiVerifyToken(token);
  } catch (e) {
    return res.status(httpConstants.HTTP_STATUS_UNAUTHORIZED).json({
      message: 'Invalid token',
    });
  }
  if (!decodedToken) {
    return res.status(httpConstants.HTTP_STATUS_UNAUTHORIZED).json({
      message: 'Invalid token',
    });
  }
  let result: WithId<UserModel> | InsertOneResult<UserModel> | null = null;
  try {
    result = await collections.users!.findOne(
      { sub: decodedToken.sub },
      { projection: { _id: 0 } }
    );

    if (result) {
      // TO DO REFACTOR
      const resultDTO: WithId<UserDTO> = {
        _id: result._id,
        sub: result.sub,
        email: result.email,
        emailVerified: result.emailVerified,
        name: result.name,
        avatar: result.avatar,
        givenName: result.givenName,
        familyName: result.familyName,
        locale: result.locale,
        username: result.username,
        discriminator: result.discriminator,
        registerTime: result.registerTime,
        joinedGroupPrivateChannels: result.joinedGroupPrivateChannels,
        friends: arrayToObject(result.friends, 'friendId'),
      };
      return res.status(httpConstants.HTTP_STATUS_OK).json(resultDTO);
    }

    let toBeDiscriminator: number = 0;
    for (let index = 0; index < 10; index++) {
      toBeDiscriminator = Math.floor(Math.random() * 9999) + 1;
      const found = await collections.users!.countDocuments(
        {
          username: decodedToken.name,
          discriminator: toBeDiscriminator,
        },
        { limit: 1 }
      );
      if (found === 0) {
        break;
      }
      toBeDiscriminator = 0;
    }

    if (toBeDiscriminator === 0) {
      return res
        .status(409)
        .json({ message: 'Failed to generate discriminator' });
    }

    result = await collections.users!.insertOne({
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
      friends: [],
      joinedGroupPrivateChannels: [],
    });

    result = await collections.users!.findOne(
      { _id: result.insertedId },
      { projection: { registerTime: 0 } }
    );

    if (!result) {
      return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        message: 'Something went wrong',
      });
    }
  } catch (e) {
    console.log(e);
    return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Something went wrong',
    });
  }

  // TO DO REFACTOR
  const resultDTO: WithId<UserDTO> = {
    _id: result._id,
    sub: result.sub,
    email: result.email,
    emailVerified: result.emailVerified,
    name: result.name,
    avatar: result.avatar,
    givenName: result.givenName,
    familyName: result.familyName,
    locale: result.locale,
    username: result.username,
    discriminator: result.discriminator,
    registerTime: result.registerTime,
    joinedGroupPrivateChannels: result.joinedGroupPrivateChannels,
    friends: arrayToObject(result.friends, 'friendId'),
  };
  return res.status(httpConstants.HTTP_STATUS_CREATED).json(resultDTO);
});

router.get(
  '/login',
  Authorize,
  async (req: express.Request, res: AuthorizedResponse) => {
    const result = {
      _id: res.locals.currentUser._id,
      sub: res.locals.currentUser.sub,
      email: res.locals.currentUser.email!,
      emailVerified: res.locals.currentUser.emailVerified!,
      name: res.locals.currentUser.name,
      avatar: res.locals.currentUser.avatar,
      givenName: res.locals.currentUser.givenName,
      familyName: res.locals.currentUser.familyName,
      locale: res.locals.currentUser.locale,
      username: res.locals.currentUser.name,
      discriminator: res.locals.currentUser.discriminator,
    };
    return res.status(httpConstants.HTTP_STATUS_OK).json(result);
  }
);

export default router;
