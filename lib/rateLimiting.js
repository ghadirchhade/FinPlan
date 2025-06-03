//import arcjet from "@arcjet/next";

/*const aj=arcjet({
    key:process.env.ARCJET_KEY,
    characteristics:["userId"], //track and apply rate limits based on clerk userId
    rules:[
        tokenBucket({
            //10 requests per hour
            mode:"LIVE",//actively block the requests that violate the rule,unlike mode: "DRY_RUN"==>Observes but doesn't block
            refillRate:2,//2 tokens every interval
            interval:3600,//interval=1 hour
            capacity:2,//max nb of tokens i.e. max requests
        }),
    ],
});

export default aj;*/

// lib/rateLimiter.ts
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error("Missing Upstash Redis environment variables.");
}
// Setup Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Define rate limit: 2 requests per hour (adding only 2 transactions per hour )
export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(4, "1 h"),
  analytics: true,
});
