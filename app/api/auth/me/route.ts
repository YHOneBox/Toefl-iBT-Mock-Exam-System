import { NextResponse } from "next/server";
import { getCurrentUser, isAdminUser, publicUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  const userCount = await prisma.user.count();
  return NextResponse.json({
    user: user ? publicUser(user) : null,
    userCount,
    isAdmin: isAdminUser(user),
  });
}
