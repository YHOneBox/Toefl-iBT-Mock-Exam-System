import { NextResponse } from "next/server";
import { appendActivity } from "@/lib/activity-log";
import { authCookie, isSecureRequest, loginUser, publicUser } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json()) as { username?: string; password?: string };
  if (!body.username || !body.password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }
  try {
    const { user, token } = await loginUser(body.username, body.password);
    appendActivity(user.id, "account", "Signed in");
    const res = NextResponse.json({ user: publicUser(user) });
    res.cookies.set(authCookie(token, isSecureRequest(req)));
    return res;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Login failed" }, { status: 401 });
  }
}
