import "dotenv/config";
import { redis } from "./redis";

async function check() {
  const pong = await redis.ping();
  console.log("Redis says:", pong);

  await redis.set("test-key", "hello");
  const value = await redis.get("test-key");
  console.log("Round-trip test:", value);
  await redis.del("test-key");

  process.exit(0);
}

check().catch((err) => {
  console.error("Redis connection failed:", err);
  process.exit(1);
});