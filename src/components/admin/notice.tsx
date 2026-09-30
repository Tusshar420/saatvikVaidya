import { FormAlert } from "@/components/site/auth/form-alert";
import { admin as copy } from "@/content/admin";

export const noticeKeys = ["created", "saved", "deleted"] as const;
export type NoticeKey = (typeof noticeKeys)[number];

/** The `?notice=` a form sets when it redirects back to a list. */
export function parseNotice(value: unknown): NoticeKey | null {
  const text = Array.isArray(value) ? value[0] : value;
  return noticeKeys.find((key) => key === text) ?? null;
}

/** "Created." / "Changes saved." / "Deleted." after a redirect. */
export function Notice({ notice }: { notice: NoticeKey | null }) {
  if (!notice) return null;
  return (
    <FormAlert tone="success" className="mt-6">
      {copy.common.notices[notice]}
    </FormAlert>
  );
}
