import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GAPI_CLIENTID);
async function gapiVerifyToken(token: string) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GAPI_CLIENTID,
  });
  const payload = ticket.getPayload();
  return payload;
}

export default gapiVerifyToken;
