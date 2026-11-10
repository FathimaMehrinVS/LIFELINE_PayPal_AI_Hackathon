import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

export const MAX_PICKUP_CODE_ATTEMPTS = 5;

export function createPickupCode(): { code: string; hash: string } {
  const code = randomInt(0, 100_000_000).toString().padStart(8, "0");
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(code, salt, 64).toString("hex");
  return { code, hash: `${salt}:${digest}` };
}

export function verifyPickupCode(code: string, storedHash: string): boolean {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex || !/^[\da-f]{128}$/i.test(expectedHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(code, salt, expected.length);
  return timingSafeEqual(actual, expected);
}
