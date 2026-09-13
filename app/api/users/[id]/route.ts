import { NextResponse } from "next/server";
import { deleteManagedUser, setManagedPassword } from "@/lib/accounts";
import { failAuth, publicUser, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = (await req.json()) as { password?: string };
    if (!body.password) {
      return NextResponse.json({ error: "New password required" }, { status: 400 });
    }
    await setManagedPassword(admin.id, id, body.password);
    const user = await prisma.user.findUnique({ where: { id } });
    return NextResponse.json({ user: user ? publicUser(user) : null });
  } catch (err) {
    return (
      failAuth(err) ??
      NextResponse.json({ error: err instanceof Error ? err.message : "Could not update user" }, { status: 400 })
    );
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    await deleteManagedUser(admin.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return (
      failAuth(err) ??
      NextResponse.json({ error: err instanceof Error ? err.message : "Could not delete user" }, { status: 400 })
    );
  }
}
