import express from 'express';
import { TokenPayload } from 'google-auth-library';
import { constants as httpConstants } from 'http2';
import { WithId } from 'mongodb';
import gapiVerifyToken from '../auth';
import mongoClient from '../database';
import { User } from '../database/schema';

interface AuthorizedResponse extends express.Response {
  locals: {
    currentUser: User;
  };
}

const Authorize = async (
  req: express.Request,
  res: AuthorizedResponse,
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(httpConstants.HTTP_STATUS_UNAUTHORIZED).json({
      message: 'Authorization header not found',
    });
  }
  const bearerFound = authHeader.indexOf('Bearer ');
  if (bearerFound < 0) {
    return res.status(httpConstants.HTTP_STATUS_UNAUTHORIZED).json({
      message: 'Authorization token format invalid',
    });
  }
  const token = authHeader.slice(bearerFound + 7);
  if (!token.length) {
    return res.status(httpConstants.HTTP_STATUS_UNAUTHORIZED).json({
      message: 'Authorization token format invalid',
    });
  }
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
  let currentUser: WithId<User> | null = null;
  try {
    await mongoClient.connect();
    const userCollection = await mongoClient
      .db(process.env.MONGODBNAME)
      .collection<User>('users');

    currentUser = await userCollection.findOne({ sub: decodedToken.sub });
  } catch (e) {
    console.log(e);

    return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Something went wrong',
    });
  } finally {
    await mongoClient.close();
  }

  if (!currentUser) {
    return res.status(httpConstants.HTTP_STATUS_FORBIDDEN).json({
      message: 'User forbidden',
    });
  }

  res.locals.currentUser = currentUser;
  next();
};

export { AuthorizedResponse };
export default Authorize;
