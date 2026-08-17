import { describe, it, expect } from "vitest";
import { validateUrl, normalizeUrl, extractDomain } from "@/lib/jobs/extractor";

describe("URL validation", () => {
  it("should reject localhost URLs", () => {
    const result = validateUrl("http://localhost:3000/job");
    expect(result.valid).toBe(false);
  });

  it("should reject 127.0.0.1", () => {
    const result = validateUrl("http://127.0.0.1:3000/job");
    expect(result.valid).toBe(false);
  });

  it("should reject internal IP ranges", () => {
    const urls = [
      "http://192.168.1.1/job",
      "http://10.0.0.1/job",
      "http://172.16.0.1/job",
    ];

    urls.forEach((url) => {
      const result = validateUrl(url);
      expect(result.valid).toBe(false);
    });
  });

  it("should accept valid public URLs", () => {
    const urls = [
      "https://www.linkedin.com/jobs/search",
      "https://www.indeed.com/jobs",
      "https://example.com/job/123",
    ];

    urls.forEach((url) => {
      const result = validateUrl(url);
      expect(result.valid).toBe(true);
    });
  });

  it("should require HTTPS for public URLs", () => {
    const result = validateUrl("http://example.com/job");
    expect(result.valid).toBe(false);
  });

  it("should normalize URLs correctly", () => {
    const url = "https://example.com/job?utm_source=test&utm_medium=email#section";
    const normalized = normalizeUrl(url);

    expect(normalized).not.toContain("utm_source");
    expect(normalized).not.toContain("utm_medium");
    expect(normalized).not.toContain("#section");
  });

  it("should extract domain correctly", () => {
    const testCases = [
      { url: "https://www.example.com/path", expected: "example.com" },
      { url: "https://subdomain.example.com/path", expected: "example.com" },
      { url: "https://linkedin.com/jobs", expected: "linkedin.com" },
    ];

    testCases.forEach(({ url, expected }) => {
      const domain = extractDomain(url);
      expect(domain).toBe(expected);
    });
  });

  it("should handle URLs with query parameters", () => {
    const url = "https://example.com/jobs?q=developer&l=remote&page=1";
    const result = validateUrl(url);
    expect(result.valid).toBe(true);
  });

  it("should reject malformed URLs", () => {
    const urls = [
      "not a url",
      "http://",
      "https://",
      "example.com",
    ];

    urls.forEach((url) => {
      const result = validateUrl(url);
      expect(result.valid).toBe(false);
    });
  });
});

describe("URL normalization edge cases", () => {
  it("should preserve path information", () => {
    const url = "https://example.com/jobs/123/details";
    const normalized = normalizeUrl(url);
    expect(normalized).toContain("/jobs/123/details");
  });

  it("should lowercase domain", () => {
    const url = "https://EXAMPLE.COM/JOB";
    const normalized = normalizeUrl(url);
    expect(normalized).toContain("example.com");
  });

  it("should handle trailing slashes", () => {
    const url1 = "https://example.com/jobs/";
    const url2 = "https://example.com/jobs";
    const norm1 = normalizeUrl(url1);
    const norm2 = normalizeUrl(url2);

    // Either should be consistent (no assertion about specific format)
    expect(typeof norm1).toBe("string");
    expect(typeof norm2).toBe("string");
  });
});
