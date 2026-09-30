"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { signIn as copy } from "@/content/sign-in";
import { useSignOut } from "./use-sign-out";

/** "Sign out" with a loading state; goes home when on a protected page. */
export function SignOutButton({
  children = copy.menu.signOut,
  ...props
}: Omit<ButtonProps, "onClick" | "loading">) {
  const signOut = useSignOut();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      icon={<LogOut aria-hidden className="size-4" />}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const done = await signOut("profile-header");
        // On success the page is left; only a failure needs the button back.
        if (!done) setBusy(false);
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
