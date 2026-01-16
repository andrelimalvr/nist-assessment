import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPasswordValidationError } from "@/lib/password";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
  confirmPassword: z.string().min(1)
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return NextResponse.json({ error: "A nova senha e a confirmacao nao conferem." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { passwordHash: true, email: true }
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  const isValid = bcrypt.compareSync(parsed.data.currentPassword, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });
  }

  const policyError = getPasswordValidationError(parsed.data.newPassword, user.email);
  if (policyError) {
    return NextResponse.json({ error: policyError }, { status: 400 });
  }

  const passwordHash = bcrypt.hashSync(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date()
    }
  });

  return NextResponse.json({ success: true });
}
