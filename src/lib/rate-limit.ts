import { redis } from "./redis";

interface RateLimitConfig {
  scope: string;       // "forgot-password", "login"
  identifier: string;  // email, or "email:ip"
  limit: number;       // max attempts allowed
  windowSeconds: number; // window size
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit({
  scope,
  identifier,
  limit,
  windowSeconds,
}: RateLimitConfig): Promise<RateLimitResult> {
  const key = `ratelimit:${scope}:${identifier}`;

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }

  const ttl = await redis.ttl(key);
  const retryAfterSeconds = ttl > 0 ? ttl : windowSeconds;

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds,
  };
}