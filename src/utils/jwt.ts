import jwt from 'jsonwebtoken';
import { env } from '../env';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
};

export function signAccessToken(user: { id: string; email: string; role: string }) {
  const expiresIn = env.ACCESS_EXPIRES as jwt.SignOptions['expiresIn'];
  const secret = env.ACCESS_TOKEN_SECRET as jwt.Secret;
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, secret, { expiresIn });
}
export function signRefreshToken(userId: string) {
  const expiresIn = env.REFRESH_EXPIRES as jwt.SignOptions['expiresIn'];
  const secret = env.REFRESH_TOKEN_SECRET as jwt.Secret;
  return jwt.sign({ sub: userId }, secret, { expiresIn });
}
export function verifyAccess(token: string) {
  return jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AccessTokenPayload;
}
export function verifyRefresh(token: string) {
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET) as { sub: string; iat: number; exp: number };
}
