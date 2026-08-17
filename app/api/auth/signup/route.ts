import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Profile, User } from "@/lib/models";
import { route, conflict } from "@/lib/api";
import { signupSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";
import { createSession, serializeUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/auth/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creates an account.
 *
 * New accounts land in `pending` and cannot sign in until an administrator
 * approves them. The single exception is the bootstrap address in ADMIN_EMAIL:
 * without it, the very first account would sit pending with nobody able to
 * approve it.
 */
export const POST = route(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const { name, email, password } = signupSchema.parse(body);

  await connectToDatabase();

  // Because `email` is uniquely indexed, at most one account can ever hold the
  // bootstrap address — so this promotion happens exactly once and then goes
  // inert without needing any extra state.
  const bootstrapEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const isBootstrapAdmin = !!bootstrapEmail && bootstrapEmail === email;

  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await User.create({
      email,
      name,
      passwordHash,
      role: isBootstrapAdmin ? "admin" : "user",
      status: isBootstrapAdmin ? "approved" : "pending",
      approvedAt: isBootstrapAdmin ? new Date() : null,
    });
  } catch (err) {
    // 11000 is MongoDB's duplicate-key error. Relying on the unique index rather
    // than a prior existence check is what makes concurrent signups with the
    // same address safe — two requests can both pass a check, but only one can
    // win the insert.
    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: number }).code === 11000
    ) {
      // This does disclose that the address is registered. The alternative —
      // claiming success and sending nothing — is a well-known source of user
      // confusion, and with signup gated behind admin approval the disclosure
      // buys an attacker very little.
      throw conflict("An account with that email address already exists.");
    }
    throw err;
  }

  // Create the (empty) profile now so later phases can assume it exists.
  await Profile.create({ userId: user._id });

  await recordAudit({
    action: "user.signup",
    actorId: String(user._id),
    targetUserId: String(user._id),
    metadata: { bootstrapAdmin: isBootstrapAdmin },
    req,
  });

  // Only the bootstrap admin is approved on creation, so only they get a
  // session. Everyone else is redirected to the waiting page.
  if (isBootstrapAdmin) {
    await createSession(String(user._id), {
      ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "",
      userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? "",
    });
  }

  return NextResponse.json(
    {
      user: serializeUser(user),
      signedIn: isBootstrapAdmin,
      message: isBootstrapAdmin
        ? "Administrator account created."
        : "Account created. An administrator needs to approve it before you can sign in.",
    },
    { status: 201 }
  );
});
