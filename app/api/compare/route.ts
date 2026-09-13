import { NextResponse } from "next/server";
import { failAuth, requireSessionForUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeSession } from "@/lib/serialize";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const a = url.searchParams.get("a");
    const b = url.searchParams.get("b");
    if (!a || !b) return NextResponse.json({ error: "a and b required" }, { status: 400 });
    await requireSessionForUser(a);
    await requireSessionForUser(b);
    const [left, right] = await Promise.all([
      prisma.examSession.findUnique({ where: { id: a }, include: { form: true, responses: true, scoreReport: true } }),
      prisma.examSession.findUnique({ where: { id: b }, include: { form: true, responses: true, scoreReport: true } }),
    ]);
    if (!left || !right) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (left.formId !== right.formId) {
      return NextResponse.json({ error: "Sessions must share a form" }, { status: 400 });
    }
    return NextResponse.json({
      left: serializeSession(left),
      right: serializeSession(right),
    });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
