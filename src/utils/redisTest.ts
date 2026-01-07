import "dotenv/config";
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

async function testRedis() {
  try {
    const res = await redis.ping();
    console.log("Redis connected:", res);
  } catch (err) {
    console.error("Redis connection failed:", err);
  } finally {
    redis.disconnect();
  }
}

testRedis();
