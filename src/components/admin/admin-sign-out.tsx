"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { admin as copy } from "@/content/admin";
import { signIn } from "@/content/sign-in";
import { signOut } from "@/lib/auth-client";

/**
 * Sign out from the admin panel, then go to the homepage. (The site's
 * SignOutButton needs the site modals, which the admin layout doesn't have.)
 */
export function AdminSignOut() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={busy}
      icon={<LogOut aria-hidden className="size-4" />}
      onClick={async () => {
        setBusy(true);
        const result = await signOut();
        if (!result.ok) {
          toast({ tone: "error", title: result.error.message });
          setBusy(false);
          return;
        }
        toast({ tone: "success", title: signIn.menu.signedOut });
        router.push("/");
      }}
    >
      {copy.signOut}
    </Button>
  );
}
