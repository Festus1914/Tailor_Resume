import { hash, verify, type Options } from "@node-rs/argon2";

/**
 * Password hashing.
 *
 * Argon2id, using the parameters OWASP currently recommends: 19 MiB of memory,
 * two iterations, one lane. Memory-hardness is the point — it makes GPU and
 * ASIC cracking expensive in a way that iteration count alone does not, which
 * is why this is preferred over bcrypt for new work.
 *
 * The Rust bindings are used instead of the `argon2` npm package because they
 * ship prebuilt binaries, so no node-gyp toolchain is needed on Windows or in
 * a deployment image.
 */

/**
 * `Algorithm.Argon2id`, which is 2.
 *
 * The enum is declared as an ambient const enum, and `isolatedModules` — which
 * Next requires — forbids reading one as a value. Referencing the *type* is
 * still fine, so the numeric member is used directly rather than dropping the
 * parameter and depending on the library's default.
 */
const ARGON2ID = 2 as Options["algorithm"];

/**
 * Set explicitly even though these happen to match the library's current
 * defaults. Hashing parameters are a security property; they should change only
 * when this code changes, not when a dependency revises a default.
 */
const HASH_OPTIONS: Options = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export const MIN_PASSWORD_LENGTH = 12;
/**
 * Upper bound on accepted input. Argon2's cost is set by its parameters rather
 * than input length, but refusing unbounded strings keeps a multi-megabyte
 * request body from becoming needless work.
 */
export const MAX_PASSWORD_LENGTH = 256;

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, HASH_OPTIONS);
}

export async function verifyPassword(
  storedHash: string,
  plaintext: string
): Promise<boolean> {
  try {
    return await verify(storedHash, plaintext);
  } catch {
    // A malformed or truncated hash is a failed verification, not a 500.
    return false;
  }
}

/**
 * A hash of an unguessable value, computed once per process.
 *
 * Used to equalize login timing: when no account exists for the submitted
 * address, the handler still performs a real verification against this hash.
 * Without it, "unknown email" returns in microseconds while "wrong password"
 * takes ~50ms, and that gap alone tells an attacker which addresses are
 * registered — no matter how carefully the error messages are worded.
 */
let dummyHashPromise: Promise<string> | null = null;

export function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(
      `unused-placeholder-${Math.random()}-${Date.now()}`
    );
  }
  return dummyHashPromise;
}

/** Burns the same work a real verification would, then always fails. */
export async function fakeVerify(plaintext: string): Promise<false> {
  await verifyPassword(await getDummyHash(), plaintext);
  return false;
}
