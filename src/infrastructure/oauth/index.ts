import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { GAPI_CLIENTID } from '../../config/env-keys';
import ITokenVerifier from './interfaces';

class GAPITokenVerifier implements ITokenVerifier {
  private client = new OAuth2Client(GAPI_CLIENTID);
  constructor() {}
  verifyToken = async (token: string): Promise<TokenPayload> => {
    const ticket = await this.client.verifyIdToken({
      idToken: token,
      audience: GAPI_CLIENTID,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid token');
    }
    return payload;
  };
}

export default GAPITokenVerifier;
