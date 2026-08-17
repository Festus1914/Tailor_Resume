import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Profile } from "@/lib/models";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guards";
import { z } from "zod";
import type { ResumeDocument } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateProfileSchema = z.object({
  masterResume: z.object({
    header: z.object({
      fullName: z.string().trim().max(200).default(""),
      headline: z.string().trim().max(200).default(""),
      email: z.string().trim().max(320).default(""),
      phone: z.string().trim().max(50).default(""),
      location: z.string().trim().max(200).default(""),
      links: z
        .array(
          z.object({
            label: z.string().trim().max(100).default(""),
            url: z.string().trim().max(500).default(""),
          })
        )
        .default([]),
    }),
    summary: z.string().max(2000).default(""),
    experience: z
      .array(
        z.object({
          company: z.string().trim().max(200).default(""),
          title: z.string().trim().max(200).default(""),
          location: z.string().trim().max(200).default(""),
          startDate: z.string().trim().max(50).default(""),
          endDate: z.string().trim().max(50).default(""),
          isCurrent: z.boolean().default(false),
          companyDescription: z.string().max(500).default(""),
          bullets: z.array(z.string().max(500)).default([]),
        })
      )
      .default([]),
    skills: z
      .array(
        z.object({
          label: z.string().trim().max(100).default(""),
          items: z.array(z.string().trim().max(100)).default([]),
        })
      )
      .default([]),
    education: z
      .array(
        z.object({
          school: z.string().trim().max(200).default(""),
          degree: z.string().trim().max(100).default(""),
          field: z.string().trim().max(100).default(""),
          startDate: z.string().trim().max(50).default(""),
          endDate: z.string().trim().max(50).default(""),
          location: z.string().trim().max(200).default(""),
          activities: z.array(z.string().max(200)).default([]),
        })
      )
      .default([]),
    certifications: z
      .array(
        z.object({
          name: z.string().trim().max(200).default(""),
          issuer: z.string().trim().max(200).default(""),
          date: z.string().trim().max(50).default(""),
        })
      )
      .default([]),
    projects: z
      .array(
        z.object({
          name: z.string().trim().max(200).default(""),
          description: z.string().max(500).default(""),
          bullets: z.array(z.string().max(300)).default([]),
          url: z.string().trim().max(500).default(""),
        })
      )
      .default([]),
  }),
  rawText: z.string().max(100000).default(""),
});

export const GET = route(async (req: NextRequest) => {
  const { user } = await requireUser();
  await connectToDatabase();

  const profile = await Profile.findOne({ userId: user._id });
  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    profile: {
      id: String(profile._id),
      userId: String(profile.userId),
      masterResume: profile.masterResume,
      rawText: profile.rawText,
      updatedAt: profile.updatedAt,
    },
  });
});

export const PATCH = route(async (req: NextRequest) => {
  const { user } = await requireUser();
  await connectToDatabase();

  const body = await req.json().catch(() => ({}));
  const data = updateProfileSchema.parse(body);

  const profile = await Profile.findOneAndUpdate(
    { userId: user._id },
    {
      masterResume: data.masterResume as ResumeDocument,
      rawText: data.rawText,
    },
    { new: true }
  );

  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    profile: {
      id: String(profile._id),
      userId: String(profile.userId),
      masterResume: profile.masterResume,
      rawText: profile.rawText,
      updatedAt: profile.updatedAt,
    },
  });
});
