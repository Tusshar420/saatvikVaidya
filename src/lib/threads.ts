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
};

export type ReplyView = {
  id: number;
  body: string;
  author: ThreadAuthor;
  createdAt: string;
};
