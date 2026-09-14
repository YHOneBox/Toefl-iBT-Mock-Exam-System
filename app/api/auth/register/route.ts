import { NextResponse } from "next/server";
import {
  authCookie,
  isSecureRequest,
  claimOrphanedRecords,
  createUser,
  getCurrentUser,
  isAdminUser,
  loginUser,
  publicUser,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const body = (await req.json()) as { username?: string; password?: string };
  if (!body.username || !body.password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }
  const current = await getCurrentUser();
  const count = await prisma.user.count();
  if (count === 0) {
    try {
      const user = await createUser(body.username, body.password);
      const { token } = await loginUser(body.username, body.password);
      await claimOrphanedRecords(user.id);
      const res = NextResponse.json({ user: publicUser(user) });
      res.cookies.set(authCookie(token, isSecureRequest(req)));
      return res;
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create user" }, { status: 400 });
    }
  }
  if (!isAdminUser(current)) {
    return NextResponse.json({ error: "Only the admin account can create users" }, { status: 403 });
  }
  try {
    const user = await createUser(body.username, body.password);
    return NextResponse.json({ user: publicUser(user) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create user" }, { status: 400 });
  }
}
