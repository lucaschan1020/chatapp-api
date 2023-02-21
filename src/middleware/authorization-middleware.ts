import express from 'express';
import { TokenPayload } from 'google-auth-library';
import { constants as httpConstants } from 'http2';
import { WithId } from 'mongodb';
import gapiVerifyToken from '../auth';
import { collections } from '../database';
import { UserDTO, UserModel } from '../database/schema';
import { arrayToObject } from '../utilities/objectArrayConverter';

type AuthorizedResponse = express.Response<
  any,
  { currentUser: WithId<UserDTO> }
>;

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
  let currentUser: WithId<UserModel> | null = null;
  try {
    currentUser = await collections.users!.findOne({
      sub: decodedToken.sub,
    });
  } catch (e) {
    console.log(e);

    return res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Something went wrong',
    });
  }

  if (!currentUser) {
    return res.status(httpConstants.HTTP_STATUS_FORBIDDEN).json({
      message: 'User forbidden',
    });
  }

  // TO DO REFACTOR
  res.locals.currentUser = {
    _id: currentUser._id,
    sub: currentUser.sub,
    email: currentUser.email,
    emailVerified: currentUser.emailVerified,
    name: currentUser.name,
    avatar: currentUser.avatar,
    givenName: currentUser.givenName,
    familyName: currentUser.familyName,
    locale: currentUser.locale,
    username: currentUser.username,
    discriminator: currentUser.discriminator,
    registerTime: currentUser.registerTime,
    joinedGroupPrivateChannels: currentUser.joinedGroupPrivateChannels,
    friends: arrayToObject(currentUser.friends, 'friendId'),
  };
  next();
};

export { AuthorizedResponse };
export default Authorize;
