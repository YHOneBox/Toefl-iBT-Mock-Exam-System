import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { prisma } from "./db";

const COOKIE = "toefl_auth";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  return prev.length === next.length && timingSafeEqual(prev, next);
}

export async function createUser(username: string, password: string) {
  const name = username.trim();
  if (name.length < 2) throw new Error("Username must be at least 2 characters");
  if (password.length < 4) throw new Error("Password must be at least 4 characters");
  const existing = await prisma.user.findUnique({ where: { username: name } });
  if (existing) throw new Error("That username is already taken");
  return prisma.user.create({
    data: { username: name, passwordHash: hashPassword(password) },
  });
}

export async function loginUser(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Invalid username or password");
  }
  const token = randomBytes(24).toString("hex");
  await prisma.authSession.create({ data: { token, userId: user.id } });
  return { user, token };
}

export async function logoutUser(token: string | undefined) {
  if (!token) return;
  await prisma.authSession.deleteMany({ where: { token } });
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const row = await prisma.authSession.findUnique({
    where: { token },
    include: { user: true },
  });
  return row?.user ?? null;
}

export function isSecureRequest(req: Request) {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function authCookie(token: string, secure = false) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure,
  };
}

export { COOKIE as AUTH_COOKIE };

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Sign in required", 401);
  return user;
}

export async function requireSessionForUser(sessionId: string) {
  const user = await requireUser();
  const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== user.id) throw new AuthError("Not found", 404);
  return { user, session };
}

export async function requireFormForUser(formId: string) {
  const user = await requireUser();
  const form = await prisma.testForm.findUnique({ where: { id: formId } });
  if (!form || form.userId !== user.id) throw new AuthError("Not found", 404);
  return { user, form };
}

export async function claimOrphanedRecords(userId: string) {
  const userCount = await prisma.user.count();
  if (userCount !== 1) return;
  await prisma.testForm.updateMany({ where: { userId: null }, data: { userId } });
  await prisma.examSession.updateMany({ where: { userId: null }, data: { userId } });
}

export function isAdminUser(user: { username: string } | null | undefined) {
  return Boolean(user && user.username.toLowerCase() === "admin");
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminUser(user)) throw new AuthError("Only the admin account can manage users", 403);
  return user;
}

export function publicUser(user: { id: string; username: string; createdAt: Date }) {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt.toISOString(),
    isAdmin: isAdminUser(user),
  };
}

export function failAuth(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}
