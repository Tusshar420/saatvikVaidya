"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/lib/auth-client";

/** Re-renders the server page once a visitor signs in, so a guest view becomes the real one. */
export function useRefreshOnSignIn() {
  const router = useRouter();
  const { data } = useAuthSession();
  const signedIn = Boolean(data?.user);
  useEffect(() => {
    if (signedIn) router.refresh();
  }, [signedIn, router]);
}
