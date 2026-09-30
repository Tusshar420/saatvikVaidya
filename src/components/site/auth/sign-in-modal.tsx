"use client";

import { Mail, Smartphone } from "lucide-react";
import { ModalContent } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shell } from "@/content/shell";
import { signIn as copy } from "@/content/sign-in";
import type { SignUpUserType } from "@/server/content/user-types";
import { EmailFlow } from "./email-flow";
import { PhoneFlow, phoneInputId, type SignedIn } from "./phone-flow";

export type SignInModalProps = {
  userTypes: readonly SignUpUserType[];
  devShowOtp: boolean;
  onSignedIn: (result: SignedIn) => void;
  onCloseAutoFocus: (event: Event) => void;
};

// Inactive tabs stay mounted (forceMount) so switching between Mobile and
// Email keeps what was typed; they're hidden instead.
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
      icon={
        <span className="text-base tracking-[-1px]">{shell.brand.mark}</span>
      }
      onOpenAutoFocus={(event) => {
        // Start in the phone field rather than on the close button.
        const phone = document.getElementById(phoneInputId);
        if (phone) {
          event.preventDefault();
          phone.focus();
        }
      }}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <Tabs defaultValue="mobile">
        <TabsList aria-label={copy.tabs.label} className="gap-6">
          <TabsTrigger
            value="mobile"
            className="inline-flex items-center gap-2"
          >
            <Smartphone aria-hidden className="size-4.5" />
            {copy.tabs.mobile}
          </TabsTrigger>
          <TabsTrigger value="email" className="inline-flex items-center gap-2">
            <Mail aria-hidden className="size-4.5" />
            {copy.tabs.email}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="mobile" forceMount className={panelClasses}>
          <PhoneFlow
            userTypes={userTypes}
            devShowOtp={devShowOtp}
            onSignedIn={onSignedIn}
          />
        </TabsContent>
        <TabsContent value="email" forceMount className={panelClasses}>
          <EmailFlow userTypes={userTypes} onSignedIn={onSignedIn} />
        </TabsContent>
      </Tabs>
      <p className="mt-5 text-small text-muted">{copy.privacyNote}</p>
    </ModalContent>
  );
}
