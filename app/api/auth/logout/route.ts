import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, logoutUser } from "@/lib/auth";
import { BASE_PATH } from "@/lib/base-path";

export async function POST() {
  const jar = await cookies();
  await logoutUser(jar.get(AUTH_COOKIE)?.value);
  jar.set({ name: AUTH_COOKIE, value: "", path: BASE_PATH, maxAge: 0 });
  return NextResponse.json({ ok: true });
}
