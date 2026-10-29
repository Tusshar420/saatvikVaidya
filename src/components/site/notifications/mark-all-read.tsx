"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { notifications as copy } from "@/content/notifications";
import { announceNotificationsChanged } from "./notification-item";

/** "Mark all as read" on /notifications: marks them, then reloads the list. */
export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function markAll() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!response.ok) throw new Error(String(response.status));
      announceNotificationsChanged(0);
      setMessage(copy.markedAllRead);
      router.refresh();
    } catch {
      setMessage(copy.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 max-sm:w-full">
      <button
        type="button"
        onClick={markAll}
        disabled={busy}
        className={buttonClasses({ variant: "secondary", size: "sm", className: "max-sm:w-full" })}
      >
        <CheckCheck aria-hidden className="size-4" />
        {copy.markAllRead}
      </button>
      <p role="status" className="text-small text-muted empty:hidden">
        {message}
      </p>
    </div>
  );
}
