import { TokenPayload } from 'google-auth-library';

interface ITokenVerifier {
  verifyToken(token: string): Promise<TokenPayload>;
}

export default ITokenVerifier;
