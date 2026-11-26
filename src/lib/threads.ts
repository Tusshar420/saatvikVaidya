// Thread (Dr. Talk) rules shared by the server and the pages. Text lives in
// src/content/threads.ts.

export const threadKinds = ["question", "case_discussion", "expert_talk"] as const;
export type ThreadKind = (typeof threadKinds)[number];

export const threadFilters = ["latest", ...threadKinds] as const;
export type ThreadFilter = (typeof threadFilters)[number];

export function isThreadFilter(value: unknown): value is ThreadFilter {
  return threadFilters.includes(value as ThreadFilter);
}

export const threadLimits = { title: 160, body: 5000, reply: 2000, page: 20 } as const;

/** A poll has 2 to 6 choices of up to 120 characters; the thread title is the question. */
export const pollLimits = { min: 2, max: 6, option: 120 } as const;

export type ThreadImageType = "image/png" | "image/jpeg" | "image/webp";

/** Images on a thread: up to 4 PNG, JPEG or WebP files of up to 5 MB each, checked again on the server from the file's bytes. */
export const threadImageUpload = {
  maxCount: 4,
  maxBytes: 5 * 1024 * 1024,
  types: { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } satisfies Record<ThreadImageType, string>,
} as const;

/** Only approved Ayurveda doctors post and reply; everyone signed in reads and likes. */
export function canWriteThreads(user: {
  userTypeKey: string;
  verificationStatus: string;
}): boolean {
  return user.userTypeKey === "doctor" && user.verificationStatus === "approved";
}

export type ThreadAuthor = { name: string; isDoctor: boolean };

export type ThreadView = {
  id: number;
  kind: ThreadKind;
  title: string;
  body: string;
  author: ThreadAuthor;
  createdAt: string;
  replyCount: number;
  likeCount: number;
  likedByMe: boolean;
  poll: PollView | null;
  /** Image ids in order; each is served by /api/thread-images/[id]. */
  images: number[];
};

export type PollView = {
  options: { id: number; label: string; votes: number }[];
  totalVotes: number;
  /** The option this viewer voted for, if any. */
  myOptionId: number | null;
  /** Results show once the viewer has voted, and always to the thread's author. */
  showResults: boolean;
};

/** Whole-number percentage of the votes; 0 when nobody has voted. */
export function pollPercent(votes: number, total: number): number {
  return total === 0 ? 0 : Math.round((votes / total) * 100);
}

export type ReplyView = {
  id: number;
  body: string;
  author: ThreadAuthor;
  createdAt: string;
};

export type TextPart = { type: "text"; value: string } | { type: "link"; value: string; href: string };

// A web address: http(s):// or www. up to the next space or "<". Punctuation
// that usually ends a sentence is trimmed off the end (see splitLinks).
const linkPattern = /\b(?:https?:\/\/|www\.)[^\s<]+/gi;

/**
 * Splits plain text into text and web links, so pasted links can be shown
 * as links. Only http and https addresses become links; "www." gets
 * "https://" in front. Nothing in the text is ever treated as HTML.
 */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(linkPattern)) {
    let value = match[0];
    // Drop trailing punctuation, and a ")" that has no "(" in the link.
    for (;;) {
      const trimmed = value.replace(/[.,;:!?'"]+$/, "");
      const unbalanced = trimmed.endsWith(")") && (trimmed.match(/\(/g)?.length ?? 0) < (trimmed.match(/\)/g)?.length ?? 0);
      const next = unbalanced ? trimmed.slice(0, -1) : trimmed;
      if (next === value) break;
      value = next;
    }
    const href = /^www\./i.test(value) ? `https://${value}` : value;
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    const start = match.index;
    if (start > last) parts.push({ type: "text", value: text.slice(last, start) });
    parts.push({ type: "link", value, href: url.href });
    last = start + value.length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}
