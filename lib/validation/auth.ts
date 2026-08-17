import { z } from "zod";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "@/lib/auth/password";
import { USER_ROLES } from "@/lib/types";

/**
 * Request validation.
 *
 * Every route parses its body through one of these before touching the
 * database. Beyond rejecting malformed input, this is the layer that prevents
 * NoSQL operator injection: a JSON body of `{"email": {"$ne": null}}` would
 * otherwise reach a query and match an arbitrary user. `z.string()` refuses the
 * object outright, so no query ever sees a non-primitive.
 */

const emailSchema = z
  .string({ required_error: "Email is required." })
  .trim()
  .min(3, "Email is required.")
  .max(320, "That email address is too long.")
  .email("Enter a valid email address.")
  .toLowerCase();

const passwordSchema = z
  .string({ required_error: "Password is required." })
  .min(
    MIN_PASSWORD_LENGTH,
    `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  )
  .max(MAX_PASSWORD_LENGTH, "That password is too long.");

export const signupSchema = z.object({
  name: z.string().trim().max(200, "That name is too long.").default(""),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // Deliberately only checked for presence, not for policy. Applying the
  // minimum-length rule at login would reject an older password that predates a
  // policy change, and the difference in response would confirm the address
  // exists.
  password: z
    .string({ required_error: "Password is required." })
    .min(1, "Password is required.")
    .max(MAX_PASSWORD_LENGTH),
});

/** Admin actions on a user account. */
export const adminUserActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().max(1000).default(""),
  }),
  z.object({ action: z.literal("disable") }),
  z.object({ action: z.literal("enable") }),
  z.object({
    action: z.literal("setRole"),
    role: z.enum(USER_ROLES),
  }),
  z.object({
    action: z.literal("setQuota"),
    monthlyJobLimit: z.number().int().min(0).max(100_000),
  }),
]);

export const adminUserListSchema = z.object({
  status: z
    .enum(["pending", "approved", "rejected", "disabled", "all"])
    .default("all"),
  role: z.enum(["admin", "user", "all"]).default("all"),
  q: z.string().trim().max(320).default(""),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AdminUserAction = z.infer<typeof adminUserActionSchema>;
export type AdminUserListQuery = z.infer<typeof adminUserListSchema>;
