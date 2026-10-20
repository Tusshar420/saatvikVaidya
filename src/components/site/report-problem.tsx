"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { CircleCheck, X } from "lucide-react";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, inputClasses, useFieldIds } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Modal, ModalClose, ModalContent } from "@/components/ui/modal";
import { reportProblem as copy } from "@/content/bug-reports";
import { useAuthSession } from "@/lib/auth-client";
import { bugReportLimits, screenshotUpload } from "@/lib/bug-report";
import { cn } from "@/lib/cn";
import { sessionErrorsJson } from "@/lib/report-client-error";

const accept = Object.keys(screenshotUpload.types).join(",");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The "Report a problem" modal card; render inside a `<Modal>`. */
export function ReportProblemModal({ onCloseAutoFocus }: { onCloseAutoFocus?: (event: Event) => void }) {
  const [sent, setSent] = useState(false);
  return (
    <ModalContent
      eyebrow={copy.eyebrow}
      title={sent ? copy.thanks.title : copy.title}
      description={sent ? undefined : copy.description}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {sent ? <Thanks /> : <ReportProblemForm onSent={() => setSent(true)} />}
    </ModalContent>
  );
}

/**
 * A button that opens its own "Report a problem" modal: for places outside
 * the site layout's modals, such as the error screens.
 */
export function ReportProblemButton({ className, children }: { className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Modal open={open} onOpenChange={setOpen}>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={className ?? buttonClasses({ variant: "link" })}
      >
        {children ?? copy.trigger}
      </button>
      {/* Mounted only while open, so each opening starts a fresh form. */}
      {open && <ReportProblemModal />}
    </Modal>
  );
}

function Thanks() {
  const signedIn = Boolean(useAuthSession().data);
  return (
    <div role="status" className="flex flex-col gap-4">
      <p className="flex gap-2.5 rounded-lg bg-brand-soft p-3.5 text-sm font-medium text-brand-dark">
        <CircleCheck aria-hidden className="mt-0.5 size-4.5 shrink-0" />
        <span>
          {copy.thanks.body} {signedIn ? copy.thanks.signedIn : copy.thanks.guest}
        </span>
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        {signedIn && (
          <ModalClose asChild>
            <Link href="/account/reports" className={buttonClasses({ className: "sm:flex-1" })}>
              {copy.thanks.myReports}
            </Link>
          </ModalClose>
        )}
        <ModalClose asChild>
          <Button variant="secondary" className="sm:flex-1">
            {copy.thanks.close}
          </Button>
        </ModalClose>
      </div>
    </div>
  );
}

type FieldErrors = { description?: string; contactEmail?: string; screenshot?: string };

function ReportProblemForm({ onSent }: { onSent: () => void }) {
  const signedIn = Boolean(useAuthSession().data);
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const descriptionIds = useFieldIds(undefined, {
    help: copy.descriptionHelp,
    error: errors.description,
  });
  const counterId = useId();
  const screenshotIds = useFieldIds(undefined, {
    help: copy.screenshotHelp(screenshotUpload.maxBytes),
    error: errors.screenshot,
  });
  const honeypotId = useId();

  const chooseFile = (chosen: File | null) => {
    setErrors((current) => ({ ...current, screenshot: undefined }));
    if (chosen && !(chosen.type in screenshotUpload.types)) {
      setErrors((current) => ({ ...current, screenshot: copy.errors.fileType }));
    } else if (chosen && chosen.size > screenshotUpload.maxBytes) {
      setErrors((current) => ({ ...current, screenshot: copy.errors.tooLarge }));
    }
    setFile(chosen);
  };

  const clearFile = () => {
    setFile(null);
    setErrors((current) => ({ ...current, screenshot: undefined }));
    if (fileInput.current) fileInput.current.value = "";
    fileInput.current?.focus();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found: FieldErrors = {};
    if (description.trim().length < bugReportLimits.descriptionMin) {
      found.description = copy.tooShort(bugReportLimits.descriptionMin);
    }
    if (!signedIn && email.trim() && !emailPattern.test(email.trim())) found.contactEmail = copy.invalidEmail;
    if (errors.screenshot) found.screenshot = errors.screenshot;
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    const form = new FormData(event.currentTarget);
    if (signedIn) form.delete("contactEmail");
    if (!file) form.delete("screenshot");
    form.set("pageUrl", window.location.href);
    form.set("screenWidth", String(window.screen.width));
    form.set("screenHeight", String(window.screen.height));
    form.set("viewportWidth", String(window.innerWidth));
    form.set("viewportHeight", String(window.innerHeight));
    form.set("pixelRatio", String(window.devicePixelRatio || 1));
    form.set("sessionErrors", sessionErrorsJson());

    setBusy(true);
    try {
      const response = await fetch("/api/bug-reports", { method: "POST", body: form });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (response.ok && result?.ok) {
        onSent();
        return;
      }
      setFormError(result?.message ?? copy.errors.failed);
    } catch {
      setFormError(copy.errors.network);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {formError && <FormAlert>{formError}</FormAlert>}
      <Field ids={descriptionIds} label={copy.descriptionLabel} help={copy.descriptionHelp} error={errors.description}>
        <textarea
          id={descriptionIds.inputId}
          name="description"
          rows={4}
          required
          maxLength={bugReportLimits.descriptionMax}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={copy.descriptionPlaceholder}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={cn(descriptionIds.describedBy, counterId)}
          className={cn(inputClasses, "h-auto min-h-28 resize-y py-3 leading-normal")}
        />
        <p id={counterId} className="mt-1 text-right text-small text-muted" aria-live="off">
          {copy.counter(description.length, bugReportLimits.descriptionMax)}
        </p>
      </Field>

      <Field ids={screenshotIds} label={copy.screenshotLabel} help={copy.screenshotHelp(screenshotUpload.maxBytes)} error={errors.screenshot}>
        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            id={screenshotIds.inputId}
            name="screenshot"
            type="file"
            accept={accept}
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            aria-invalid={errors.screenshot ? true : undefined}
            aria-describedby={screenshotIds.describedBy}
            className="min-h-11 w-full min-w-0 cursor-pointer rounded-md border border-dashed border-line bg-surface-alt p-1.5 text-sm text-muted file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-sm file:border-0 file:bg-brand-soft file:px-3 file:text-sm file:font-bold file:text-brand"
          />
          {file && (
            <IconButton label={copy.removeScreenshot} variant="soft" onClick={clearFile}>
              <X aria-hidden />
            </IconButton>
          )}
        </div>
      </Field>

      {!signedIn && (
        <Input
          name="contactEmail"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={bugReportLimits.emailMax}
          label={copy.emailLabel}
          help={copy.emailHelp}
          error={errors.contactEmail}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      )}

      {/* Honeypot: off-screen and skipped by keyboard and screen readers; people leave it empty. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={honeypotId}>{copy.honeypotLabel}</label>
        <input id={honeypotId} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <p className="text-small text-muted">{copy.attached(signedIn)}</p>
      <Button type="submit" loading={busy} className="w-full">
        {copy.submit}
      </Button>
    </form>
  );
}
