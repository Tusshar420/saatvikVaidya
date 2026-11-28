"use client";

import { KeyRound, Mail, Smartphone } from "lucide-react";
import { ModalContent } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "../logo";
import { signIn as copy } from "@/content/sign-in";
import type { SignUpUserType } from "@/server/content/user-types";
import { EmailFlow } from "./email-flow";
import { phoneSignInEnabled } from "@/lib/auth-methods";
import { OtpFlow, otpInputIds, type SignedIn } from "./otp-flow";

export type SignInModalProps = {
  userTypes: readonly SignUpUserType[];
  devShowOtp: boolean;
  onSignedIn: (result: SignedIn) => void;
  onCloseAutoFocus: (event: Event) => void;
};

// Inactive tabs stay mounted (forceMount) so switching between them keeps
// what was typed; they're hidden instead. The Mobile tab is left out while
// phoneSignInEnabled is false (no SMS provider yet).

/** The tab the modal opens on, and the field focused there. */
const firstTab = phoneSignInEnabled ? "mobile" : "email-code";
const firstField = phoneSignInEnabled ? otpInputIds.phone : otpInputIds.email;
const panelClasses = "data-[state=inactive]:hidden";

/**
 * The mockup's "My Profile" modal as the sign-in / register flow: a bottom
 * sheet on phones, a centred card from 560 px up. The flows' state resets
 * each time it opens, because Radix unmounts the content when closed.
 */
export function SignInModal({
  userTypes,
  devShowOtp,
  onSignedIn,
  onCloseAutoFocus,
}: SignInModalProps) {
  return (
    <ModalContent
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      centered
      logo={<Logo asLink={false} imageClassName="h-17 w-33.75 sm:h-17 sm:w-33.75 md:h-17 md:w-33.75" />}
      onOpenAutoFocus={(event) => {
        // Start in the first field rather than on the close button.
        const field = document.getElementById(firstField);
        if (field) {
          event.preventDefault();
          field.focus();
        }
      }}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <Tabs defaultValue={firstTab}>
        <TabsList
          aria-label={copy.tabs.label}
          variant="pill"
          className={phoneSignInEnabled ? "grid grid-cols-3" : "grid grid-cols-2"}
        >
          {phoneSignInEnabled && (
            <TabsTrigger
              value="mobile"
              className="inline-flex items-center justify-center gap-2"
            >
              <Smartphone aria-hidden className="size-4.5 shrink-0" />
              {copy.tabs.mobile}
            </TabsTrigger>
          )}
          <TabsTrigger
            value="email-code"
            className="inline-flex items-center justify-center gap-2"
          >
            <Mail aria-hidden className="size-4.5 shrink-0" />
            {copy.tabs.emailCode}
          </TabsTrigger>
          <TabsTrigger value="email" className="inline-flex items-center justify-center gap-2">
            <KeyRound aria-hidden className="size-4.5 shrink-0" />
            {copy.tabs.password}
          </TabsTrigger>
        </TabsList>
        {phoneSignInEnabled && (
          <TabsContent value="mobile" forceMount className={panelClasses}>
            <OtpFlow
              channel="phone"
              userTypes={userTypes}
              devShowOtp={devShowOtp}
              onSignedIn={onSignedIn}
            />
          </TabsContent>
        )}
        <TabsContent value="email-code" forceMount className={panelClasses}>
          <OtpFlow
            channel="email"
            userTypes={userTypes}
            devShowOtp={devShowOtp}
            onSignedIn={onSignedIn}
          />
        </TabsContent>
        <TabsContent value="email" forceMount className={panelClasses}>
          <EmailFlow userTypes={userTypes} onSignedIn={onSignedIn} />
        </TabsContent>
      </Tabs>
      <p className="mt-4 text-center text-[11px] text-muted">{copy.privacyNote}</p>
    </ModalContent>
  );
}
