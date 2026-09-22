import jwt from "jsonwebtoken";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;

if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  throw new Error("ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be set");
}

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
export const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export interface AccessTokenPayload {
  userId: string; // userId
  organizationId: string;
  isOwner: boolean;
  type: "access";
}

export interface RefreshTokenPayload {
  userId: string; 
  sessionId: string; // ties this token to a specific sessions row
  type: "refresh";
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "access" }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "refresh" }, REFRESH_TOKEN_SECRET, {
    expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d`,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as AccessTokenPayload;
  if (decoded.type !== "access") throw new Error("Invalid token type");
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
  if (decoded.type !== "refresh") throw new Error("Invalid token type");
  return decoded;
}