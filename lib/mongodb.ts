import mongoose from "mongoose";

/**
 * Mongoose connection helper for Next.js.
 *
 * Next.js reloads modules on every edit in development, and serverless
 * platforms may cold-start a new function instance per request. Calling
 * `mongoose.connect()` naively in either environment opens a fresh connection
 * pool each time and quickly exhausts the server's connection limit (Atlas's
 * shared tiers cap at 500). Caching the connection promise on `globalThis` —
 * which survives module reloads — means every caller shares one pool.
 */

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache =
  global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

export const DEFAULT_DB_NAME = "resume_tailor";

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  // Read env inside the function rather than at module scope: this module gets
  // imported during `next build`, where MONGODB_URI may legitimately be absent.
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to your .env.local file (see .env.example)."
    );
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB || DEFAULT_DB_NAME,
      // Keep the pool small: many small serverless instances each holding a
      // large pool is what exhausts the cluster's connection budget.
      maxPoolSize: 10,
      minPoolSize: 0,
      // Fail fast with a clear error instead of hanging the request for 30s
      // when the cluster is unreachable or the IP isn't allowlisted.
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
      // Index builds are a schema migration, not request-path work. In
      // development the convenience is worth it; in production indexes are
      // created deliberately via `ensureIndexes()` so a cold request never
      // blocks on an index build.
      autoIndex: process.env.NODE_ENV !== "production",
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // Don't cache a rejected promise — otherwise one transient failure makes
    // every subsequent request fail for the lifetime of the process.
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}

/** True when the shared connection is currently usable. */
export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Closes the shared connection. Intended for scripts and tests — the web app
 * should keep the pool warm for the lifetime of the process.
 */
export async function disconnectFromDatabase(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
  }
  cache.conn = null;
  cache.promise = null;
}
