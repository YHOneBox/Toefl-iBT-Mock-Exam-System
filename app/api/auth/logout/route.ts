import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, logoutUser } from "@/lib/auth";

export async function POST() {
  const jar = await cookies();
  await logoutUser(jar.get(AUTH_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: AUTH_COOKIE, value: "", path: "/", maxAge: 0 });
  res.cookies.set({ name: AUTH_COOKIE, value: "", path: "/toefl", maxAge: 0 });
  res.cookies.set({ name: AUTH_COOKIE, value: "", path: "/toefl/toefl", maxAge: 0 });
  return res;
}
