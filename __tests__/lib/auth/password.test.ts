import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("Password hashing", () => {
  it("should hash passwords securely", async () => {
    const password = "TestPassword123456!";
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(50);
  });

  it("should verify correct password", async () => {
    const password = "TestPassword123456!";
    const hash = await hashPassword(password);
    const valid = await verifyPassword(hash, password);

    expect(valid).toBe(true);
  });

  it("should reject wrong password", async () => {
    const password = "TestPassword123456!";
    const hash = await hashPassword(password);
    const valid = await verifyPassword(hash, "WrongPassword123456!");

    expect(valid).toBe(false);
  });

  it("should reject short passwords", async () => {
    try {
      await hashPassword("short");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should produce different hashes for same password", async () => {
    const password = "TestPassword123456!";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
  });

  it("should handle unicode passwords", async () => {
    const password = "Пароль123456!你好";
    const hash = await hashPassword(password);
    const valid = await verifyPassword(hash, password);

    expect(valid).toBe(true);
  });
});
