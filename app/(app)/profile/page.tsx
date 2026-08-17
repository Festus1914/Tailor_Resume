import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { connectToDatabase } from "@/lib/mongodb";
import { Profile } from "@/lib/models";
import ProfileEditor from "@/components/profile/ProfileEditor";

export const metadata: Metadata = { title: "Profile — Resume Tailor" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user } = await requireUser();
  await connectToDatabase();

  const profile = await Profile.findOne({ userId: user._id });
  if (!profile) {
    throw new Error("Profile not found");
  }

  const plainProfile = profile.toObject();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-ink mb-2">
          Master Resume
        </h1>
        <p className="text-black/50">
          Build your complete professional profile. This is your source of truth
          for all resume tailoring.
        </p>
      </header>

      <ProfileEditor
        initialProfile={{
          id: String(plainProfile._id),
          userId: String(plainProfile.userId),
          masterResume: plainProfile.masterResume,
          rawText: plainProfile.rawText,
        }}
      />
    </div>
  );
}
