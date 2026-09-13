import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, logoutUser } from "@/lib/auth";

export async function POST() {
  const jar = await cookies();
  await logoutUser(jar.get(AUTH_COOKIE)?.value);
  jar.delete(AUTH_COOKIE);
  return NextResponse.json({ ok: true });
}
