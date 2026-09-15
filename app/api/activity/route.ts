import { NextResponse } from "next/server";
import { failAuth, requireUser } from "@/lib/auth";
import { listActivity } from "@/lib/activity-log";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ entries: listActivity(user.id) });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
