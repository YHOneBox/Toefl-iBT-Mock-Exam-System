import { NextResponse } from "next/server";
import { failAuth, publicUser, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { forms: true, exams: true } } },
    });
    return NextResponse.json({
      users: users.map((user) => ({
        ...publicUser(user),
        testCount: user._count.forms,
        attemptCount: user._count.exams,
      })),
    });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
