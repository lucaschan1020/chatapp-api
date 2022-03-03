import 'dotenv/config';
import express from 'express';
import { TokenPayload } from 'google-auth-library';
import { ModifyResult } from 'mongodb';
import verifyToken from '../auth';
import mongoClient from '../database';
import { User } from '../database/schema';

const router = express.Router();

interface LoginRequestBody extends express.Request {
  body: { userToken: string };
}

router.post('/login', async (req: LoginRequestBody, res) => {
  const token = req.body.userToken;
  let decodedToken: TokenPayload | undefined = undefined;
  try {
    decodedToken = await verifyToken(token);
  } catch (e) {
    return res.status(401).json({
      message: 'Invalid token',
    });
  }
  if (!decodedToken) {
    return res.status(401).json({
      message: 'Invalid token',
    });
  }
  let result: ModifyResult<User> | undefined = undefined;
  try {
    await mongoClient.connect();
    const userCollection = await mongoClient
      .db(process.env.MONGODBNAME)
      .collection<User>('users');
    result = await userCollection.findOneAndUpdate(
      { sub: decodedToken.sub },
      {
        $setOnInsert: {
          sub: decodedToken.sub,
          email: decodedToken.email,
          email_verified: decodedToken.email_verified,
          name: decodedToken.name,
          avatar: decodedToken.picture,
          given_name: decodedToken.given_name,
          family_name: decodedToken.family_name,
          locale: decodedToken.locale,
        },
      },
      {
        upsert: true,
        projection: { _id: 0 },
      }
    );
  } catch (e) {
    console.log(e);
    return res.status(500).json({
      message: 'Something went wrong',
    });
  } finally {
    await mongoClient.close();
  }

  return res.status(200).json(result?.value);
});

export default router;
