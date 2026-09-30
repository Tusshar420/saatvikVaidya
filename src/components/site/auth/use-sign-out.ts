"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { signIn as copy } from "@/content/sign-in";
import { signOut } from "@/lib/auth-client";
import { protectedPathPrefixes } from "@/lib/auth-routes";
import { useRequestFocus } from "../site-modals";

/**
 * Signs out, says so in a toast, and leaves protected pages for the
 * homepage. `focusKey` names the button that should take focus afterwards
 * (see useClaimFocus). Resolves to false if signing out failed.
 */
export function useSignOut(): (focusKey?: string) => Promise<boolean> {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const requestFocus = useRequestFocus();

  return useCallback(
    async (focusKey) => {
      const result = await signOut();
      if (!result.ok) {
        toast({ tone: "error", title: result.error.message });
        return false;
      }
      toast({ tone: "success", title: copy.menu.signedOut });
      if (focusKey) requestFocus(focusKey);
      const onProtectedPage = protectedPathPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      );
      if (onProtectedPage) router.push("/");
      else router.refresh();
      return true;
    },
    [pathname, requestFocus, router, toast],
  );
}
