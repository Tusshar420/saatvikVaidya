"use client";

import { useActionState, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  recordTwoFactorEnabledAction,
  regenerateBackupCodesAction,
  startTwoFactorAction,
  type SetupState,
} from "@/app/(site)/account/two-factor/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { adminSecurity } from "@/content/admin-security";
import { verifyTwoFactor } from "@/lib/auth-client";

const copy = adminSecurity.twoFactor;
const idle: SetupState = { status: "idle" };

function BackupCodes({ codes }: { codes: string[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface-alt p-4">
      <h3 className="text-base font-extrabold text-ink">{copy.backupTitle}</h3>
      <p className="mt-1 text-sm text-muted">{copy.backupHelp}</p>
      <ul
        data-testid="backup-codes"
        className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm font-bold text-ink"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
    </div>
  );
}

/** First sign-in setup: password, scan, first code, backup codes. */
export function TwoFactorSetup() {
  const [start, startAction, starting] = useActionState(startTwoFactorAction, idle);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string>();
  const [confirming, setConfirming] = useState(false);

  // The first code is checked in the browser (see recordTwoFactorEnabledAction).
  const confirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    setConfirming(true);
    setConfirmError(undefined);
    const result = await verifyTwoFactor("totp", code);
    if (result.ok) {
      await recordTwoFactorEnabledAction();
      setConfirmed(true);
    } else {
      setConfirmError(adminSecurity.errors.wrongCode);
    }
    setConfirming(false);
  };

  if (confirmed) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert tone="success">{copy.done}</FormAlert>
        {start.backupCodes && <BackupCodes codes={start.backupCodes} />}
        {/* A full page load, so the admin area sees the new session. */}
        <a href="/admin" className={buttonClasses({ className: "self-start max-sm:w-full" })}>
          {copy.openAdmin}
        </a>
      </div>
    );
  }

  if (start.status !== "success") {
    return (
      <form action={startAction} noValidate className="flex flex-col gap-4">
        {start.status === "error" && <FormAlert>{start.message}</FormAlert>}
        <PasswordInput
          name="password"
          label={copy.passwordLabel}
          help={copy.passwordHelp}
          autoComplete="current-password"
          maxLength={1024}
          required
        />
        <Button type="submit" loading={starting} className="self-start max-sm:w-full">
          {copy.start}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">{copy.scan}</p>
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        {/* A generated SVG data URL: the QR code of the setup link. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimise */}
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(start.qrSvg ?? "")}`}
          alt=""
          width={192}
          height={192}
          className="size-48 rounded-lg border border-line bg-white p-1"
        />
        <div className="min-w-0">
          <p className="text-label text-muted uppercase">{copy.manualKey}</p>
          <code data-testid="manual-key" className="mt-1 block text-sm font-bold break-all text-ink">
            {start.manualKey}
          </code>
        </div>
      </div>
      {start.backupCodes && <BackupCodes codes={start.backupCodes} />}
      <form onSubmit={confirm} noValidate className="flex flex-col gap-4">
        {confirmError && <FormAlert>{confirmError}</FormAlert>}
        <Input
          name="code"
          label={copy.codeLabel}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          wrapperClassName="max-w-xs"
        />
        <Button type="submit" loading={confirming} className="self-start max-sm:w-full">
          {copy.confirm}
        </Button>
      </form>
    </div>
  );
}

/** For an admin who already has it: make new backup codes. */
export function BackupCodesForm() {
  const [state, action, pending] = useActionState(regenerateBackupCodesAction, idle);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted">{copy.regenerateHelp}</p>
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      {state.backupCodes && <BackupCodes codes={state.backupCodes} />}
      <PasswordInput
        name="password"
        label={copy.passwordLabel}
        autoComplete="current-password"
        maxLength={1024}
        required
      />
      <Button type="submit" variant="secondary" loading={pending} className="self-start max-sm:w-full">
        {copy.regenerate}
      </Button>
    </form>
  );
}

export function OpenAdminLink() {
  return (
    <Link href="/admin" className={buttonClasses({ className: "self-start max-sm:w-full" })}>
      {copy.openAdmin}
    </Link>
  );
}
