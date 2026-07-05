export interface TailorRequest {
  resumeText: string;
  jobDescription: string;
  companyName?: string;
  applicantName?: string;
}

export interface TailorResult {
  tailoredResume: string;
  matchScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryOfChanges: string[];
  coverLetter: string;
}
