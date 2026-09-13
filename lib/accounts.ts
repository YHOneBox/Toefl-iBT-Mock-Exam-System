import fs from "fs";
import { hashPassword, isAdminUser } from "./auth";
import { prisma } from "./db";
import { formAudioDir, sessionRecordingDir } from "./paths";

export function assertPassword(password: string) {
  if (password.length < 4) throw new Error("Password must be at least 4 characters");
}

export async function setManagedPassword(adminId: string, targetId: string, password: string) {
  assertPassword(password);
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw new Error("User not found");
  await prisma.user.update({
    where: { id: targetId },
    data: { passwordHash: hashPassword(password) },
  });
  if (targetId !== adminId) {
    await prisma.authSession.deleteMany({ where: { userId: targetId } });
  }
}

export async function deleteManagedUser(adminId: string, targetId: string) {
  if (targetId === adminId) throw new Error("You cannot delete the signed-in admin account");
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    include: { forms: { select: { id: true } }, exams: { select: { id: true } } },
  });
  if (!target) throw new Error("User not found");
  if (isAdminUser(target)) throw new Error("The admin account cannot be deleted");
  for (const exam of target.exams) {
    fs.rmSync(sessionRecordingDir(exam.id), { recursive: true, force: true });
  }
  for (const form of target.forms) {
    fs.rmSync(formAudioDir(form.id), { recursive: true, force: true });
  }
  await prisma.user.delete({ where: { id: targetId } });
}
