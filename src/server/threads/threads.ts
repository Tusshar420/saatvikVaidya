import "server-only";
import { z } from "zod";
import {
  canWriteThreads,
  threadKinds,
  threadLimits,
  type ReplyView,
  type ThreadFilter,
  type ThreadView,
} from "@/lib/threads";
import { threads as copy } from "@/content/threads";
import { db } from "@/server/db";

// Dr. Talk threads: a feed that signed-in users read and approved doctors
// write. Every write checks the writer from the database (not the session
// cookie), and the author is always the session's user id, never the form's.

const authorSelect = {
  select: { name: true, verificationStatus: true, userType: { select: { key: true } } },
} as const;

type AuthorRow = {
  name: string;
  verificationStatus: "none" | "pending" | "approved" | "rejected";
  userType: { key: string };
};

const toAuthor = (row: AuthorRow) => ({
  name: row.name,
  isDoctor: canWriteThreads({ userTypeKey: row.userType.key, verificationStatus: row.verificationStatus }),
});

/** May this user post, reply and like? Read fresh from the database. */
export async function canWrite(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { verificationStatus: true, userType: { select: { key: true } } },
  });
  return Boolean(user && canWriteThreads({ userTypeKey: user.userType.key, verificationStatus: user.verificationStatus }));
}

type ThreadRow = {
  id: number;
  kind: ThreadView["kind"];
  title: string;
  body: string;
  createdAt: Date;
  author: AuthorRow;
  _count: { replies: number; likes: number };
  likes: { userId: string }[];
};

const threadSelect = (viewerId: string) =>
  ({
    id: true,
    kind: true,
    title: true,
    body: true,
    createdAt: true,
    author: authorSelect,
    _count: { select: { replies: { where: { hidden: false } }, likes: true } },
    likes: { where: { userId: viewerId }, select: { userId: true } },
  }) as const;

const toThread = (row: ThreadRow): ThreadView => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  author: toAuthor(row.author),
  createdAt: row.createdAt.toISOString(),
  replyCount: row._count.replies,
  likeCount: row._count.likes,
  likedByMe: row.likes.length > 0,
});

export async function listThreads(viewerId: string, filter: ThreadFilter): Promise<ThreadView[]> {
  const rows = await db.thread.findMany({
    where: { hidden: false, ...(filter === "latest" ? {} : { kind: filter }) },
    orderBy: { createdAt: "desc" },
    take: threadLimits.page,
    select: threadSelect(viewerId),
  });
  return rows.map(toThread);
}

export async function readThread(
  viewerId: string,
  id: number,
): Promise<{ thread: ThreadView; replies: ReplyView[] } | null> {
  const row = await db.thread.findFirst({
    where: { id, hidden: false },
    select: {
      ...threadSelect(viewerId),
      replies: {
        where: { hidden: false },
        orderBy: { createdAt: "asc" },
        take: 200,
        select: { id: true, body: true, createdAt: true, author: authorSelect },
      },
    },
  });
  if (!row) return null;
  return {
    thread: toThread(row),
    replies: row.replies.map((reply) => ({
      id: reply.id,
      body: reply.body,
      author: toAuthor(reply.author),
      createdAt: reply.createdAt.toISOString(),
    })),
  };
}

export type ThreadResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: "forbidden" | "notFound" | "invalid"; fieldErrors?: Record<string, string> };

const newThread = z.object({
  kind: z.enum(threadKinds, { error: copy.errors.kind }),
  title: z.string().trim().min(3, copy.errors.title).max(threadLimits.title, copy.errors.title),
  body: z.string().trim().min(10, copy.errors.body).max(threadLimits.body, copy.errors.body),
});

export async function createThread(userId: string, input: unknown): Promise<ThreadResult<{ id: number }>> {
  if (!(await canWrite(userId))) return { ok: false, error: "forbidden" };
  const parsed = newThread.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: firstErrors(parsed.error) };
  const row = await db.thread.create({ data: { ...parsed.data, authorId: userId }, select: { id: true } });
  return { ok: true, id: row.id };
}

const newReply = z.object({
  body: z.string().trim().min(1, copy.errors.reply).max(threadLimits.reply, copy.errors.reply),
});

export async function addReply(userId: string, threadId: number, input: unknown): Promise<ThreadResult> {
  if (!(await canWrite(userId))) return { ok: false, error: "forbidden" };
  const parsed = newReply.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: firstErrors(parsed.error) };
  const thread = await db.thread.findFirst({ where: { id: threadId, hidden: false }, select: { id: true } });
  if (!thread) return { ok: false, error: "notFound" };
  await db.threadReply.create({ data: { threadId, authorId: userId, body: parsed.data.body } });
  return { ok: true };
}

/** Likes the thread, or removes the like if there already is one. */
export async function toggleLike(userId: string, threadId: number): Promise<ThreadResult<{ liked: boolean }>> {
  if (!(await canWrite(userId))) return { ok: false, error: "forbidden" };
  const thread = await db.thread.findFirst({ where: { id: threadId, hidden: false }, select: { id: true } });
  if (!thread) return { ok: false, error: "notFound" };
  const key = { threadId_userId: { threadId, userId } };
  const existing = await db.threadLike.findUnique({ where: key });
  if (existing) {
    await db.threadLike.delete({ where: key });
    return { ok: true, liked: false };
  }
  await db.threadLike.create({ data: { threadId, userId } });
  return { ok: true, liked: true };
}

function firstErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}
