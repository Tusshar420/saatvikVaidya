"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminSecurity } from "@/content/admin-security";
import { verifyTwoFactor } from "@/lib/auth-client";

const copy = adminSecurity.signIn;

export type TwoFactorStepProps = {
  onVerified: (name: string) => void;
  /** Back to the password form (used when the sign-in has expired). */
  onBack: () => void;
};

/** The second step of an admin's sign-in: an authenticator or backup code. */
export function TwoFactorStep({ onVerified, onBack }: TwoFactorStepProps) {
  const [backup, setBackup] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [backup]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const value = code.trim();
    if (!value) {
      setError(copy.wrong);
      return;
    }
    setBusy(true);
    setError(undefined);
    const result = await verifyTwoFactor(backup ? "backup" : "totp", value);
    setBusy(false);
    if (result.ok) onVerified(result.data.user.name);
    else setError(result.error.message);
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col">
      <h3 className="text-lg font-extrabold text-ink">{copy.title}</h3>
      <p className="mt-1 text-sm text-muted">
        {backup ? copy.backupHelp : copy.intro}
      </p>
      <div className="mt-4">
        <Input
          ref={inputRef}
          name="code"
          label={backup ? copy.backupLabel : copy.code}
          inputMode={backup ? "text" : "numeric"}
          autoComplete="one-time-code"
          maxLength={backup ? 24 : 6}
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setError(undefined);
          }}
          error={error}
        />
      </div>
      <Button type="submit" arrow loading={busy} className="mt-4 w-full">
        {copy.submit}
      </Button>
      <Button
        type="button"
        variant="link"
        className="mt-3 self-center text-small font-bold"
        onClick={() => {
          setBackup((current) => !current);
          setCode("");
          setError(undefined);
        }}
      >
        {backup ? copy.useApp : copy.useBackup}
      </Button>
      <Button
        type="button"
        variant="link"
        className="self-center text-small font-bold"
        onClick={onBack}
      >
        {copy.back}
      </Button>
    </form>
  );
}
