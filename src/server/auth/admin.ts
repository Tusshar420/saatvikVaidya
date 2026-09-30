import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { isCommonPassword } from "./common-passwords";
import { passwordPolicy } from "./policy";
import { emailSchema, nameSchema } from "./schemas";

// Used by `pnpm admin:create` (scripts/admin-create.ts). Admins are never
// self-registered; this is the only code that sets role "admin". No
// "server-only" import: it runs under tsx.

export const adminInputSchema = z.object({
  ADMIN_EMAIL: emailSchema,
  ADMIN_PASSWORD: z
    .string()
    .min(
      passwordPolicy.adminMinLength,
      `ADMIN_PASSWORD must be at least ${passwordPolicy.adminMinLength} characters`,
    )
    .max(passwordPolicy.maxLength)
    .refine((password) => !isCommonPassword(password), {
      message: "ADMIN_PASSWORD is a common password; choose another",
    }),
  ADMIN_NAME: nameSchema.default("Saatvik Vaidya Admin"),
});

export type AdminInput = z.input<typeof adminInputSchema>;

/** Better Auth-style id: 32 random URL-safe characters. */
export function newId(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Creates the admin account, or updates it if the email exists: sets role
 * "admin", the name and a new password, and signs out its other sessions.
 * The admin gets the "customer" user type (admin is a role, not a type).
 */
export async function upsertAdmin(
  db: PrismaClient,
  input: AdminInput,
): Promise<{ id: string; email: string; created: boolean }> {
  const {
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD,
    ADMIN_NAME: name,
  } = adminInputSchema.parse(input);

  const customer = await db.userType.findUnique({
    where: { key: "customer" },
    select: { id: true },
  });
  if (!customer) {
    throw new Error('No "customer" user type. Run `pnpm db:seed` first.');
  }
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  return db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      await tx.user.update({
        where: { id: existing.id },
        data: { role: "admin", name, emailVerified: true },
      });
      const credential = await tx.account.findFirst({
        where: { userId: existing.id, providerId: "credential" },
        select: { id: true },
      });
      if (credential) {
        await tx.account.update({
          where: { id: credential.id },
          data: { password: passwordHash },
        });
      } else {
        await tx.account.create({
          data: {
            id: newId(),
            userId: existing.id,
            accountId: existing.id,
            providerId: "credential",
            password: passwordHash,
          },
        });
      }
      await tx.session.deleteMany({ where: { userId: existing.id } });
      return { id: existing.id, email, created: false };
    }

    const id = newId();
    await tx.user.create({
      data: {
        id,
        name,
        email,
        emailVerified: true,
        role: "admin",
        verificationStatus: "none",
        userTypeId: customer.id,
        termsAcceptedAt: new Date(),
        accounts: {
          create: {
            id: newId(),
            accountId: id,
            providerId: "credential",
            password: passwordHash,
          },
        },
      },
    });
    return { id, email, created: true };
  });
}
