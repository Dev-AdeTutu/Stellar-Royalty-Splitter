/**
 * Express Middleware for Distributed Rate Limiting (#978).
 *
 * Wraps the distributed Token Bucket and Sliding Window rate limiters.
 * Extracts client identifiers (API key, user ID, wallet address, IP),
 * checks rate limits atomically against Redis, sets standard headers
 * (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After),
 * and responds with a standard 429 payload when quota is exhausted.
 */

import { distributedRateLimiter } from "../rate-limiter/distributed.js";
import { sendError } from "../error-response.js";
import logger from "../logger.js";

/**
 * Default key generator extracting user identifier from request.
 * Priorities: API key -> authenticated user -> wallet address in body -> client IP.
 *
 * @param {import("express").Request} req
 * @returns {string} Client identifier
 */
export function defaultKeyGenerator(req) {
  if (req.headers && req.headers["x-api-key"]) {
    return `apikey:${req.headers["x-api-key"]}`;
  }
  if (req.user && (req.user.id || req.user.address)) {
    return `user:${req.user.id || req.user.address}`;
  }
  if (req.body && req.body.walletAddress) {
    return `wallet:${req.body.walletAddress}`;
  }
  return `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
}

/**
 * Default endpoint generator extracting HTTP method and route path.
 *
 * @param {import("express").Request} req
 * @returns {string} Endpoint identifier
 */
export function defaultEndpointGenerator(req) {
  if (req.route && req.route.path) {
    return `${req.method}:${req.baseUrl || ""}${req.route.path}`;
  }
  const rawPath = (req.baseUrl || "") + (req.path || req.originalUrl || "/");
  const cleanPath = rawPath.split("?")[0].replace(/\/+$/, "") || "/";
  return `${req.method}:${cleanPath}`;
}

/**
 * Creates Express middleware for distributed rate limiting.
 *
 * @param {object} [options]
 * @param {DistributedRateLimiter} [options.limiter] - Limiter instance (defaults to singleton)
 * @param {"token-bucket"|"sliding-window"} [options.algorithm="token-bucket"] - Limiting algorithm
 * @param {number} [options.capacity=60] - Max burst capacity for token bucket
 * @param {number} [options.refillRatePerSec=10] - Token refill rate per second for token bucket
 * @param {number} [options.limit=100] - Request limit for sliding window
 * @param {number} [options.windowMs=60000] - Window duration in ms for sliding window
 * @param {number} [options.cost=1] - Token cost per request
 * @param {(req: import("express").Request) => string} [options.keyGenerator] - Custom key extractor
 * @param {(req: import("express").Request) => string} [options.endpointGenerator] - Custom endpoint extractor
 * @param {(req: import("express").Request) => boolean} [options.skip] - Predicate to bypass rate limit
 * @param {boolean} [options.recordErrors=true] - Track 5xx errors for adaptive rate limiting
 * @returns {import("express").RequestHandler} Express middleware
 */
export function createDistributedRateLimit({
  limiter = distributedRateLimiter,
  algorithm = "token-bucket",
  capacity = 60,
  refillRatePerSec = 10,
  limit = 100,
  windowMs = 60000,
  cost = 1,
  keyGenerator = defaultKeyGenerator,
  endpointGenerator = defaultEndpointGenerator,
  skip = () => false,
  recordErrors = true,
} = {}) {
  return async function distributedRateLimitMiddleware(req, res, next) {
    if (skip(req)) {
      return next();
    }

    const userKey = keyGenerator(req);
    const endpoint = endpointGenerator(req);

    try {
      let result;

      if (algorithm === "sliding-window") {
        result = await limiter.consumeSlidingWindow(userKey, endpoint, {
          limit,
          windowMs,
        });
      } else {
        result = await limiter.consumeTokenBucket(userKey, endpoint, {
          capacity,
          refillRatePerSec,
          cost,
        });
      }

      // Populate standard rate limit response headers
      res.setHeader("X-RateLimit-Limit", String(result.limit));
      res.setHeader("X-RateLimit-Remaining", String(result.remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(result.resetTimeMs / 1000)));

      if (result.adaptiveApplied) {
        res.setHeader("X-RateLimit-Adaptive", "active");
      }

      if (result.allowed) {
        // Track error responses on response completion for adaptive throttling
        if (recordErrors) {
          res.on("finish", () => {
            if (res.statusCode >= 500) {
              void limiter.recordResult(userKey, endpoint, true);
            } else if (res.statusCode < 400) {
              void limiter.recordResult(userKey, endpoint, false);
            }
          });
        }
        return next();
      }

      // Rate limit exceeded (429)
      const retryAfterSec = result.retryAfterSeconds || 1;
      res.setHeader("Retry-After", String(retryAfterSec));

      logger.warn("Distributed rate limit exceeded", {
        userKey,
        endpoint,
        retryAfterSeconds: retryAfterSec,
        ip: req.ip,
      });

      return sendError(
        res,
        429,
        "too_many_requests",
        "Rate limit exceeded. Please retry later.",
        { retryAfterSeconds: retryAfterSec }
      );
    } catch (err) {
      logger.error("Distributed rate limit middleware error:", err);
      return next();
    }
  };
}

export const distributedRateLimit = createDistributedRateLimit();
export default createDistributedRateLimit;
