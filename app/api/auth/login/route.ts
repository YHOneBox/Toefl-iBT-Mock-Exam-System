import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authCookie, isSecureRequest, loginUser, publicUser } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json()) as { username?: string; password?: string };
  if (!body.username || !body.password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }
  try {
    const { user, token } = await loginUser(body.username, body.password);
    const jar = await cookies();
    jar.set(authCookie(token, isSecureRequest(req)));
    return NextResponse.json({ user: publicUser(user) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Login failed" }, { status: 401 });
  }
}
