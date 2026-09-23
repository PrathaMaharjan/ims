import Redis from "ioredis";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not set");
}

declare global {
  var _redis: Redis | undefined;
}

export const redis =
  global._redis ??
  new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
  });

if (process.env.NODE_ENV !== "production") {
  global._redis = redis;
}

redis.on("error", (err) => {
  console.error("[redis] connection error:", err.message);
});