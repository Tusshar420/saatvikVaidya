"use server";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isAPIError } from "better-auth/api";
import QRCode from "qrcode";
import { z } from "zod";
import { adminSecurity as copy } from "@/content/admin-security";
import { authErrors } from "@/content/auth";
import { logAdminAction } from "@/server/admin/audit";
import { auth } from "@/server/auth";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";

// Two-factor setup for the signed-in admin. Admins only (anyone else gets a
// 404). It goes through Better Auth, so its password check, code lockout and
// our per-IP limits apply; each change is also written to the admin log.

export type SetupState = {
  status: "idle" | "error" | "success";
  message?: string;
  /** Step 1 done: the QR code (SVG), the manual key and the backup codes. */
  qrSvg?: string;
  manualKey?: string;
  backupCodes?: string[];
};

async function requireAdminAccount() {
  const session = await requireUser("/account/two-factor");
  if (session.user.role !== "admin") notFound();
  return session;
}

function failure(error: unknown, fallback: string): SetupState {
  if (isAPIError(error)) {
    if (error.status === "TOO_MANY_REQUESTS") {
      return { status: "error", message: authErrors.RATE_LIMITED };
    }
    const code = (error.body as { code?: string } | undefined)?.code ?? "";
    if (code.includes("INVALID_PASSWORD")) {
      return { status: "error", message: copy.errors.wrongPassword };
    }
    if (code.includes("INVALID_CODE") || code.includes("INVALID_BACKUP")) {
      return { status: "error", message: copy.errors.wrongCode };
    }
    if (code.includes("LOCKED") || code.includes("TOO_MANY")) {
      return { status: "error", message: copy.errors.tooMany };
    }
  }
  return { status: "error", message: fallback };
}

const passwordSchema = z.object({ password: z.string().min(1).max(1024) });

/** Step 1: check the password, create the secret, show it with backup codes. */
export async function startTwoFactorAction(
  _previous: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const { user } = await requireAdminAccount();
  if (user.twoFactorEnabled) return { status: "error", message: copy.errors.generic };
  const parsed = passwordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { status: "error", message: copy.errors.wrongPassword };
  }
  try {
    const reply = await auth.api.enableTwoFactor({
      body: { password: parsed.data.password, method: "totp" },
      headers: await headers(),
    });
    if (reply.method !== "totp") return { status: "error", message: copy.errors.generic };
    const manualKey = new URL(reply.totpURI).searchParams.get("secret") ?? "";
    const qrSvg = await QRCode.toString(reply.totpURI, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
    });
    return {
      status: "success",
      qrSvg,
      manualKey,
      backupCodes: reply.backupCodes,
    };
  } catch (error) {
    return failure(error, copy.errors.generic);
  }
}

/**
 * Step 2 happens in the browser (a call to Better Auth's verify endpoint),
 * because turning two-factor on swaps the session, and a server action can't
 * keep the page it re-renders on the new session. This then writes it to the
 * admin log, once the account really has it on.
 */
export async function recordTwoFactorEnabledAction(): Promise<boolean> {
  const { user } = await requireAdminAccount();
  if (!user.twoFactorEnabled) return false;
  const recent = await db.adminLog.count({
    where: {
      userId: user.id,
      action: "admin.2fa.enable",
      createdAt: { gt: new Date(Date.now() - 60_000) },
    },
  });
  if (recent === 0) {
    await db.$transaction((tx) =>
      logAdminAction(tx, {
        actorId: user.id,
        action: "admin.2fa.enable",
        resource: "Admin",
        resourceId: user.id,
        changes: { twoFactorEnabled: { from: false, to: true } },
      }),
    );
  }
  return true;
}

/** New backup codes (the old ones stop working). Needs the password again. */
export async function regenerateBackupCodesAction(
  _previous: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const { user } = await requireAdminAccount();
  if (!user.twoFactorEnabled) return { status: "error", message: copy.errors.generic };
  const parsed = passwordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { status: "error", message: copy.errors.wrongPassword };
  try {
    const reply = await auth.api.generateBackupCodes({
      body: { password: parsed.data.password },
      headers: await headers(),
    });
    await db.$transaction((tx) =>
      logAdminAction(tx, {
        actorId: user.id,
        action: "admin.backup-codes.regenerate",
        resource: "Admin",
        resourceId: user.id,
      }),
    );
    return { status: "success", backupCodes: reply.backupCodes };
  } catch (error) {
    return failure(error, copy.errors.generic);
  }
}
