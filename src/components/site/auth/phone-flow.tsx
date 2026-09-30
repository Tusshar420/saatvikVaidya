"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { authErrors } from "@/content/auth";
import { signIn as copy } from "@/content/sign-in";
import {
  sendOtp,
  verifyOtp,
  type AuthFailure,
  type Registration,
} from "@/lib/auth-client";
import { formatIndianPhone, isValidIndianMobile } from "@/lib/phone";
import type { SignUpUserType } from "@/server/content/user-types";
import { DevOtpBanner } from "./dev-otp-banner";
import { FormAlert } from "./form-alert";
import {
  emptyRegistration,
  focusFirstError,
  RegistrationFields,
  toRegistration,
  validateRegistration,
  type RegistrationErrors,
  type RegistrationValues,
} from "./registration-fields";
import { useCountdown } from "./use-countdown";

/** Seconds before "Resend code" can be used. */
const RESEND_AFTER_SECONDS = 30;

/** Codes that mean the OTP itself is no good: ask for (or type) another. */
const otpErrorCodes = new Set<AuthFailure["code"]>([
  "INVALID_OTP",
  "OTP_EXPIRED",
  "OTP_NOT_FOUND",
  "TOO_MANY_ATTEMPTS",
]);

/** The phone input's id, so the modal can focus it when it opens. */
export const phoneInputId = "sign-in-phone";

type Step = "phone" | "otp" | "register";

export type SignedIn = { name: string; isNew: boolean };

export type PhoneFlowProps = {
  userTypes: readonly SignUpUserType[];
  devShowOtp: boolean;
  onSignedIn: (result: SignedIn) => void;
};

/**
 * Mobile sign-in: number, then the SMS code. A number without an account
 * gets a short register step; the same code is sent again with the details.
 */
export function PhoneFlow({
  userTypes,
  devShowOtp,
  onSignedIn,
}: PhoneFlowProps) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"send" | "verify" | "resend" | null>(null);
  const [phoneError, setPhoneError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const [resendError, setResendError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [registration, setRegistration] =
    useState<RegistrationValues>(emptyRegistration);
  const [registrationErrors, setRegistrationErrors] =
    useState<RegistrationErrors>({});
  const [registerError, setRegisterError] = useState<string>();
  // Set once valid details were entered, so after a new code they're sent
  // along straight away instead of asking again.
  const [registrationReady, setRegistrationReady] = useState(false);
  const [resendLeft, startResendTimer] = useCountdown();

  const phoneRef = useRef<HTMLInputElement>(null);
  const otpFormRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const registerFormRef = useRef<HTMLFormElement>(null);

  const focusOtp = () =>
    otpFormRef.current?.querySelector<HTMLInputElement>("input")?.focus();

  // Move focus to the new step's first field (not on first render: the
  // modal focuses the phone field when it opens). Inputs are never disabled
  // while a request runs, so focus can always go back to them on an error;
  // the busy buttons stop double submits.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (step === "phone") phoneRef.current?.focus();
    if (step === "otp") focusOtp();
    if (step === "register") nameRef.current?.focus();
  }, [step]);

  const submitPhone = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!isValidIndianMobile(phone)) {
      setPhoneError(authErrors.INVALID_PHONE_NUMBER);
      phoneRef.current?.focus();
      return;
    }
    setBusy("send");
    setPhoneError(undefined);
    const result = await sendOtp(phone);
    setBusy(null);
    if (!result.ok) {
      setPhoneError(result.error.message);
      phoneRef.current?.focus();
      return;
    }
    setCode("");
    setCodeError(undefined);
    setResendError(undefined);
    setNotice(undefined);
    startResendTimer(RESEND_AFTER_SECONDS);
    setStep("otp");
  };

  const resend = async () => {
    if (busy || resendLeft > 0) return;
    setBusy("resend");
    setResendError(undefined);
    setNotice(undefined);
    const result = await sendOtp(phone);
    setBusy(null);
    if (!result.ok) {
      setResendError(result.error.message);
      return;
    }
    setCode("");
    setCodeError(undefined);
    setNotice(copy.otp.resent);
    startResendTimer(RESEND_AFTER_SECONDS);
    focusOtp();
  };

  /** Sends the code (and the details, if we have them). */
  const verify = async (otp: string, details?: Registration) => {
    setBusy("verify");
    const result = await verifyOtp(phone, otp, details);
    setBusy(null);

    if (result.ok) {
      if (result.data.status) {
        onSignedIn({ name: result.data.user.name, isNew: Boolean(details) });
      } else {
        setStep("register");
      }
      return;
    }

    const { code: errorCode, message } = result.error;
    if (otpErrorCodes.has(errorCode) || step !== "register") {
      // Back to (or stay on) the code step with the message under the boxes.
      if (details) setRegistrationReady(true);
      setCode("");
      setCodeError(message);
      setNotice(undefined);
      if (step === "otp") focusOtp();
      else setStep("otp");
      return;
    }
    if (errorCode === "TERMS_NOT_ACCEPTED") {
      setRegistrationErrors({ terms: message });
      focusFirstError(registerFormRef.current, { terms: message }, ["terms"]);
    } else if (errorCode === "INVALID_USER_TYPE") {
      setRegistrationErrors({ userType: message });
      focusFirstError(registerFormRef.current, { userType: message }, [
        "userType",
      ]);
    } else {
      setRegisterError(message);
    }
  };

  const submitCode = (event?: FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    if (code.length !== 6) {
      setCodeError(copy.otp.incomplete);
      focusOtp();
      return;
    }
    setCodeError(undefined);
    void verify(
      code,
      registrationReady ? toRegistration(registration) : undefined,
    );
  };

  const submitRegistration = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const errors = validateRegistration(registration);
    setRegistrationErrors(errors);
    setRegisterError(undefined);
    if (Object.keys(errors).length > 0) {
      focusFirstError(registerFormRef.current, errors, [
        "name",
        "userType",
        "terms",
      ]);
      return;
    }
    void verify(code, toRegistration(registration));
  };

  if (step === "phone") {
    return (
      <form noValidate onSubmit={submitPhone} className="flex flex-col">
        <PhoneInput
          ref={phoneRef}
          id={phoneInputId}
          label={copy.phone.label}
          placeholder={copy.phone.placeholder}
          value={phone}
          onValueChange={(digits) => {
            setPhone(digits);
            setPhoneError(undefined);
          }}
          error={phoneError}
        />
        <Button
          type="submit"
          arrow
          loading={busy === "send"}
          className="mt-3.5 w-full"
        >
          {copy.phone.submit}
        </Button>
      </form>
    );
  }

  if (step === "otp") {
    const displayPhone = formatIndianPhone(phone);
    return (
      <div className="flex flex-col">
        <h3 className="text-lg font-extrabold text-ink">{copy.otp.heading}</h3>
        <p className="mt-1 text-sm text-muted">
          {copy.otp.sentTo(displayPhone)}{" "}
          <Button
            type="button"
            variant="link"
            className="-my-3 inline-flex font-extrabold"
            onClick={() => {
              setCodeError(undefined);
              setStep("phone");
            }}
          >
            {copy.otp.changeNumber}
          </Button>
        </p>
        {devShowOtp && (
          <div className="mt-4">
            <DevOtpBanner phone={phone} />
          </div>
        )}
        <form
          ref={otpFormRef}
          noValidate
          onSubmit={submitCode}
          className="mt-4 flex flex-col"
        >
          <OtpInput
            label={copy.otp.label}
            value={code}
            onValueChange={(next) => {
              setCode(next);
              setCodeError(undefined);
            }}
            onComplete={(full) => {
              if (busy) return;
              setCodeError(undefined);
              void verify(
                full,
                registrationReady ? toRegistration(registration) : undefined,
              );
            }}
            error={codeError}
          />
          {notice && (
            <FormAlert tone="success" className="mt-3">
              {notice}
            </FormAlert>
          )}
          {resendError && <FormAlert className="mt-3">{resendError}</FormAlert>}
          <Button
            type="submit"
            arrow
            loading={busy === "verify"}
            className="mt-4 w-full"
          >
            {copy.otp.submit}
          </Button>
          <Button
            type="button"
            variant="link"
            className="mt-2 self-center"
            disabled={resendLeft > 0 || busy !== null}
            loading={busy === "resend"}
            onClick={resend}
          >
            {resendLeft > 0 ? copy.otp.resendIn(resendLeft) : copy.otp.resend}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form
      ref={registerFormRef}
      noValidate
      onSubmit={submitRegistration}
      className="flex flex-col"
    >
      <h3 className="text-lg font-extrabold text-ink">
        {copy.register.heading}
      </h3>
      <p className="mt-1 mb-4 text-sm text-muted">{copy.register.lead}</p>
      {userTypes.length === 0 ? (
        <FormAlert>{copy.register.unavailable}</FormAlert>
      ) : (
        <RegistrationFields
          values={registration}
          onChange={(patch) => {
            setRegistration((current) => ({ ...current, ...patch }));
            setRegistrationErrors((current) => {
              const next = { ...current };
              if ("name" in patch) delete next.name;
              if ("userTypeId" in patch) delete next.userType;
              if ("terms" in patch) delete next.terms;
              return next;
            });
          }}
          errors={registrationErrors}
          userTypes={userTypes}
          nameRef={nameRef}
        />
      )}
      {registerError && <FormAlert className="mt-4">{registerError}</FormAlert>}
      <Button
        type="submit"
        arrow
        loading={busy === "verify"}
        disabled={userTypes.length === 0}
        className="mt-5 w-full"
      >
        {copy.register.submitPhone}
      </Button>
    </form>
  );
}
