import crypto from "node:crypto";

const DEMO_PASSWORD = "demo123";

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, expected] = storedHash.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function demoUsers() {
  return [
    { id: 1, username: "cs-demo", displayName: "CS Demo", role: "CS", passwordHash: hashPassword(DEMO_PASSWORD, "cs-demo-salt") },
    { id: 2, username: "data-demo", displayName: "Staf Data Demo", role: "DATA", passwordHash: hashPassword(DEMO_PASSWORD, "data-demo-salt") },
    { id: 3, username: "owner-demo", displayName: "Pemilik Demo", role: "OWNER", passwordHash: hashPassword(DEMO_PASSWORD, "owner-demo-salt") }
  ];
}

export function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value));
}

export function sessionCookie(token, maxAgeSeconds = 60 * 60 * 8) {
  return `scentra_session=${token}; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}; Path=/`;
}
