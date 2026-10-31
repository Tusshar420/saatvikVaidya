import "server-only";
import { z } from "zod";
import {
  canWriteThreads,
  pollLimits,
  threadImageUpload,
  threadKinds,
  threadLimits,
  type PollView,
  type ReplyView,
  type ThreadFilter,
  type ThreadView,
} from "@/lib/threads";
import { threads as copy } from "@/content/threads";
import { db } from "@/server/db";
import { deleteFilesQuietly, getStorage, newFileKey } from "@/server/storage";
import { checkUpload } from "@/server/storage/files";

// Dr. Talk threads: a feed that signed-in users read and like, and approved
// doctors write. Every write checks the writer from the database (not the
// session cookie), and the author is always the session's user id, never the
// form's.

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

/** May this user post and reply? Read fresh from the database. */
export async function canWrite(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { verificationStatus: true, userType: { select: { key: true } } },
  });
  return Boolean(user && canWriteThreads({ userTypeKey: user.userType.key, verificationStatus: user.verificationStatus }));
}

type ThreadRow = {
  id: number;
  authorId: string;
  kind: ThreadView["kind"];
  title: string;
  body: string;
  createdAt: Date;
  author: AuthorRow;
  _count: { replies: number; likes: number };
  likes: { userId: string }[];
  pollOptions: { id: number; label: string; _count: { votes: number } }[];
  pollVotes: { optionId: number }[];
  images: { id: number }[];
};

const threadSelect = (viewerId: string) =>
  ({
    id: true,
    authorId: true,
    kind: true,
    title: true,
    body: true,
    createdAt: true,
    author: authorSelect,
    _count: { select: { replies: { where: { hidden: false } }, likes: true } },
    likes: { where: { userId: viewerId }, select: { userId: true } },
    pollOptions: {
      orderBy: { position: "asc" },
      select: { id: true, label: true, _count: { select: { votes: true } } },
    },
    pollVotes: { where: { userId: viewerId }, select: { optionId: true } },
    images: { orderBy: { position: "asc" }, select: { id: true } },
  }) as const;

function toPoll(row: ThreadRow, viewerId: string): PollView | null {
  if (row.pollOptions.length === 0) return null;
  const options = row.pollOptions.map((option) => ({ id: option.id, label: option.label, votes: option._count.votes }));
  const myOptionId = row.pollVotes[0]?.optionId ?? null;
  return {
    options,
    totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
    myOptionId,
    showResults: myOptionId !== null || row.authorId === viewerId,
  };
}

const toThread = (row: ThreadRow, viewerId: string): ThreadView => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  author: toAuthor(row.author),
  createdAt: row.createdAt.toISOString(),
  replyCount: row._count.replies,
  likeCount: row._count.likes,
  likedByMe: row.likes.length > 0,
  poll: toPoll(row, viewerId),
  images: row.images.map((image) => image.id),
});

export async function listThreads(viewerId: string, filter: ThreadFilter): Promise<ThreadView[]> {
  const rows = await db.thread.findMany({
    where: { hidden: false, ...(filter === "latest" ? {} : { kind: filter }) },
    orderBy: { createdAt: "desc" },
    take: threadLimits.page,
    select: threadSelect(viewerId),
  });
  return rows.map((row) => toThread(row, viewerId));
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
    thread: toThread(row, viewerId),
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

// Blank choices are dropped, so a form with six boxes and three filled in
// makes a three-choice poll.
const pollOptions = z
  .array(z.string().trim().max(pollLimits.option, copy.errors.pollOption))
  .max(pollLimits.max, copy.errors.pollCount)
  .transform((list) => list.filter(Boolean))
  .refine((list) => list.length >= pollLimits.min, copy.errors.pollCount)
  .refine((list) => new Set(list.map((option) => option.toLowerCase())).size === list.length, copy.errors.pollDuplicate);

const newThread = z.object({
  kind: z.enum(threadKinds, { error: copy.errors.kind }),
  title: z.string().trim().min(3, copy.errors.title).max(threadLimits.title, copy.errors.title),
  body: z.string().trim().min(10, copy.errors.body).max(threadLimits.body, copy.errors.body),
  pollOptions: pollOptions.optional(),
});

/**
 * Starts a thread. `images` are the raw files the doctor attached; each one's
 * real type and size are checked from its bytes before anything is saved.
 */
export async function createThread(
  userId: string,
  input: unknown,
  images: Uint8Array[] = [],
): Promise<ThreadResult<{ id: number }>> {
  if (!(await canWrite(userId))) return { ok: false, error: "forbidden" };
  const parsed = newThread.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: firstErrors(parsed.error) };
  if (images.length > threadImageUpload.maxCount) {
    return { ok: false, error: "invalid", fieldErrors: { images: copy.errors.imageCount } };
  }
  const files: { key: string; contentType: string; bytes: Uint8Array }[] = [];
  for (const bytes of images) {
    const checked = checkUpload(bytes, threadImageUpload);
    if (!checked.ok) {
      const message = checked.error === "tooLarge" ? copy.errors.imageTooLarge : copy.errors.imageType;
      return { ok: false, error: "invalid", fieldErrors: { images: message } };
    }
    files.push({ key: newFileKey("threads", userId, checked.extension), contentType: checked.contentType, bytes });
  }

  const { pollOptions: options, ...thread } = parsed.data;
  try {
    // Files first, then the rows that point at them; if the rows fail, the
    // files are removed again.
    for (const file of files) await getStorage().put(file.key, file.bytes);
    const row = await db.thread.create({
      data: {
        ...thread,
        authorId: userId,
        ...(options && { pollOptions: { create: options.map((label, position) => ({ label, position })) } }),
        ...(files.length > 0 && {
          images: {
            create: files.map((file, position) => ({ fileKey: file.key, contentType: file.contentType, position })),
          },
        }),
      },
      select: { id: true },
    });
    return { ok: true, id: row.id };
  } catch (error) {
    await deleteFilesQuietly(files.map((file) => file.key));
    throw error;
  }
}

/** A thread image for a signed-in member; null if the id is wrong or its thread is hidden. */
export async function findViewableThreadImage(id: number): Promise<{ key: string; contentType: string } | null> {
  const image = await db.threadImage.findFirst({
    where: { id, thread: { hidden: false } },
    select: { fileKey: true, contentType: true },
  });
  return image && { key: image.fileKey, contentType: image.contentType };
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

/** May this user like threads? Any signed-in member, read fresh from the database. */
export async function canLike(userId: string): Promise<boolean> {
  return Boolean(await db.user.findUnique({ where: { id: userId }, select: { id: true } }));
}

/** Likes the thread, or removes the like if there already is one. Open to every member. */
export async function toggleLike(userId: string, threadId: number): Promise<ThreadResult<{ liked: boolean }>> {
  if (!(await canLike(userId))) return { ok: false, error: "forbidden" };
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

/**
 * Votes in a thread's poll. Open to every signed-in member, like likes.
 * Choosing another option moves the vote; choosing the same one removes it.
 */
export async function votePoll(
  userId: string,
  threadId: number,
  optionId: number,
): Promise<ThreadResult<{ optionId: number | null }>> {
  if (!(await canLike(userId))) return { ok: false, error: "forbidden" };
  const option = await db.threadPollOption.findFirst({
    where: { id: optionId, threadId, thread: { hidden: false } },
    select: { id: true },
  });
  if (!option) return { ok: false, error: "notFound" };
  const key = { threadId_userId: { threadId, userId } };
  const existing = await db.threadPollVote.findUnique({ where: key, select: { optionId: true } });
  if (existing?.optionId === optionId) {
    await db.threadPollVote.delete({ where: key });
    return { ok: true, optionId: null };
  }
  await db.threadPollVote.upsert({ where: key, create: { threadId, userId, optionId }, update: { optionId } });
  return { ok: true, optionId };
}

function firstErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}
