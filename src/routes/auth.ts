import 'dotenv/config';
import express from 'express';
import { TokenPayload } from 'google-auth-library';
import { constants as httpConstants } from 'http2';
import { InsertOneResult, WithId } from 'mongodb';
import gapiVerifyToken from '../auth';
import mongoClient from '../database';
import { User } from '../database/schema';
import Authorize, {
  AuthorizedResponse,
} from '../middleware/authorization-middleware';

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
  let result: WithId<User> | InsertOneResult<User> | null = null;
  try {
    await mongoClient.connect();
    const userCollection = await mongoClient
      .db(process.env.MONGODBNAME)
      .collection<User>('users');

    result = await userCollection.findOne(
      { sub: decodedToken.sub },
      { projection: { _id: 0 } }
    );

    if (result) {
      return res.status(httpConstants.HTTP_STATUS_OK).json(result);
    }

    let toBeDiscriminator: number = 0;
    for (let index = 0; index < 10; index++) {
      toBeDiscriminator = Math.floor(Math.random() * 9999) + 1;
      const found = await userCollection.countDocuments({
        username: decodedToken.name,
        discriminator: toBeDiscriminator,
      });
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

    result = await userCollection.insertOne({
      sub: decodedToken.sub,
      email: decodedToken.email!,
      email_verified: decodedToken.email_verified!,
      name: decodedToken.name!,
      avatar: decodedToken.picture!,
      given_name: decodedToken.given_name!,
      family_name: decodedToken.family_name!,
      locale: decodedToken.locale!,
      username: decodedToken.name!,
      discriminator: toBeDiscriminator,
      register_time: new Date(),
      friends: [],
    });

    result = await userCollection.findOne(
      { _id: result.insertedId },
      { projection: { register_time: 0 } }
    );
  } catch (e) {
    console.log(e);
    return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Something went wrong',
    });
  } finally {
    await mongoClient.close();
  }
  return res.status(httpConstants.HTTP_STATUS_CREATED).json(result);
});

router.get(
  '/login',
  Authorize,
  async (req: express.Request, res: AuthorizedResponse) => {
    const result = {
      _id: res.locals.currentUser._id,
      sub: res.locals.currentUser.sub,
      email: res.locals.currentUser.email!,
      email_verified: res.locals.currentUser.email_verified!,
      name: res.locals.currentUser.name,
      avatar: res.locals.currentUser.avatar,
      given_name: res.locals.currentUser.given_name,
      family_name: res.locals.currentUser.family_name,
      locale: res.locals.currentUser.locale,
      username: res.locals.currentUser.name,
      discriminator: res.locals.currentUser.discriminator,
    };
    return res.status(httpConstants.HTTP_STATUS_OK).json(result);
  }
);

export default router;
