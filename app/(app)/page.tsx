import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { connectToDatabase } from "@/lib/mongodb";
import { Profile, Batch } from "@/lib/models";
import { CheckCircle, Zap, ArrowRight } from "lucide-react";

export default async function Home() {
  const { user } = await requireUser();
  await connectToDatabase();

  const [profile, recentBatches] = await Promise.all([
    Profile.findOne({ userId: user._id }),
    Batch.find({ userId: user._id }).sort({ createdAt: -1 }).limit(3),
  ]);

  const profileComplete =
    profile &&
    profile.masterResume.header.fullName.trim().length > 0 &&
    profile.masterResume.experience.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      {/* Welcome Section */}
      <header className="mb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-serif font-bold text-ink mb-2">
          Welcome back, {user.name || user.email.split("@")[0]}
        </h1>
        <p className="text-black/50 max-w-xl mx-auto text-sm sm:text-base">
          Tailor your resume to any job in seconds using AI
        </p>
      </header>

      {/* Your Saved Profile Section */}
      <div className="mb-12 bg-gradient-to-br from-accentLight to-accent/5 border border-accent/20 rounded-2xl p-8">
        <h2 className="text-xl font-semibold text-ink mb-6">Your Saved Profile</h2>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-3 bg-white rounded-lg p-4">
            {profileComplete ? (
              <CheckCircle size={24} className="text-accent flex-shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full border-2 border-black/20 flex-shrink-0" />
            )}
            <div>
              <p className="text-xs uppercase tracking-wide text-black/40 font-medium">
                Master Resume
              </p>
              <p className="text-sm font-medium text-ink">
                {profileComplete ? "✓ Saved" : "Not yet set up"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white rounded-lg p-4">
            <CheckCircle size={24} className="text-accent flex-shrink-0" />
            <div>
              <p className="text-xs uppercase tracking-wide text-black/40 font-medium">
                Professional Info
              </p>
              <p className="text-sm font-medium text-ink">✓ Saved</p>
            </div>
          </div>
        </div>

        <Link
          href="/profile"
          className="inline-flex items-center gap-2 bg-accent text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          {profileComplete ? "Update Profile" : "Complete Profile"}
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Job Applications Section */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold text-ink mb-6">Job Applications</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Batch Processing Card */}
          <Link
            href="/batch"
            className="bg-white border border-black/10 rounded-2xl p-6 hover:border-accent/30 hover:shadow-lg transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-accentLight rounded-lg flex items-center justify-center">
                <Zap size={20} className="text-accent" />
              </div>
              <ArrowRight size={16} className="text-black/20 group-hover:text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-ink mb-2">Paste Job Links</h3>
            <p className="text-sm text-black/60 mb-4">
              Add up to 100 job links and tailor your resume for all of them at once
            </p>
            <div className="flex items-center gap-2 text-xs text-accent font-medium">
              Go to Batch <ArrowRight size={12} />
            </div>
          </Link>

          {/* Quick Stats */}
          <div className="bg-white border border-black/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-ink mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-black/40 font-medium mb-1">
                  Total Batches
                </p>
                <p className="text-2xl font-bold text-ink">
                  {recentBatches.length}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-black/40 font-medium mb-1">
                  Last Activity
                </p>
                <p className="text-sm text-black/60">
                  {recentBatches.length > 0
                    ? new Date(
                        recentBatches[0].createdAt
                      ).toLocaleDateString()
                    : "No activity yet"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Batches */}
      {recentBatches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-ink">Recent Batches</h2>
            <Link href="/batch" className="text-xs text-accent hover:underline font-medium">
              View all →
            </Link>
          </div>

          <div className="space-y-3">
            {recentBatches.map((batch) => (
              <Link
                key={String(batch._id)}
                href={`/batch/${batch._id}`}
                className="flex items-center justify-between bg-white border border-black/10 rounded-lg p-4 hover:border-accent/30 transition-colors group"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">
                    {batch.submittedCount} job{batch.submittedCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-black/40">
                    {new Date(batch.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                      batch.status === "completed"
                        ? "bg-accentLight text-accent"
                        : batch.status === "running"
                          ? "bg-black/5 text-black/60"
                          : "bg-[#fdf1ea] text-[#b3452c]"
                    }`}
                  >
                    {batch.status === "completed" && "✓"}
                    {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                  </span>
                  <ArrowRight size={14} className="text-black/20 group-hover:text-accent" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
