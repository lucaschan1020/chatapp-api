import express from 'express';
import { TokenPayload } from 'google-auth-library';
import verifyToken from '../auth';

const router = express.Router();

interface LoginRequestBody {
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
  return res.status(200).json();
});

export default router;
