import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ebookCoverSrc } from "@/lib/ebooks";
import { rateLimitRules } from "@/server/auth/policy";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { getSetting } from "@/server/content/settings";
import { db } from "@/server/db";
import { getStorage, type StoredFile } from "@/server/storage";

// Ebooks for readers (docs/CHUNKS.md, P1.8): the /ebooks pages, "My ebooks"
// on /account and the download route. Who may download is decided only by
// ebookAccess() below:
//
// - Free books: any signed-in user.
// - Paid books: buyers only, meaning a paid order line for the book whose
//   order wasn't cancelled. Buyers keep access if the book is hidden later.
// - Downloads pause when the site-wide switch ("ebooks.downloads") or the
//   book's own switch is off, or before a file is uploaded.
// - Admins can always download (to check an upload).
//
// The file is never at a public URL: /api/ebooks/[id]/download checks all
// this, counts the download against a rate limit, then streams it.

/** Who is looking: null when signed out. */
export type EbookViewer = { id: string; role: string } | null;

/** What the reader can do with a book. */
export type EbookAccess =
  /** Download it now. */
  | "download"
  /** A free book: sign in to download. */
  | "sign_in"
  /** A paid book they don't own: add it to the cart. */
  | "buy"
  /** They may have it, but downloads are paused (switch off or no file yet). */
  | "paused"
  /** Hidden, or a paid book with no price: nothing to do. */
  | "unavailable";

export type AccessFacts = {
  signedIn: boolean;
  isAdmin: boolean;
  isFree: boolean;
  active: boolean;
  /** Bought (paid, not cancelled). */
  owned: boolean;
  hasFile: boolean;
  siteDownloads: boolean;
  bookDownloads: boolean;
};

/** The access rules, as a pure function so they're easy to test. */
export function ebookAccess(facts: AccessFacts): EbookAccess {
  const downloadable = facts.hasFile && facts.siteDownloads && facts.bookDownloads;
  if (facts.isAdmin) return facts.hasFile ? "download" : "paused";
  if (facts.owned) return downloadable ? "download" : "paused";
  if (!facts.active) return "unavailable";
  if (facts.isFree) {
    if (!facts.signedIn) return "sign_in";
    return downloadable ? "download" : "paused";
  }
  return "buy";
}

/** True when downloads of this book are paused for everyone. */
export const downloadsPaused = (
  book: { fileKey: string | null; downloadsEnabled: boolean },
  siteDownloads: boolean,
) => !siteDownloads || !book.downloadsEnabled || !book.fileKey;

/** An order line that makes its buyer an owner: paid and not cancelled. */
const ownedLineWhere = (userId: string): Prisma.OrderItemWhereInput => ({
  kind: "ebook",
  order: { userId, paidAt: { not: null }, status: { not: "cancelled" } },
});

/** Which of these ebooks the user has bought. */
export async function ownedEbookIds(
  userId: string,
  ebookIds?: readonly number[],
  client: Prisma.TransactionClient = db,
): Promise<Set<number>> {
  const rows = await client.orderItem.findMany({
    where: {
      ...ownedLineWhere(userId),
      ebookId: ebookIds ? { in: [...ebookIds] } : { not: null },
    },
    distinct: ["ebookId"],
    select: { ebookId: true },
  });
  return new Set(rows.flatMap((row) => (row.ebookId === null ? [] : [row.ebookId])));
}

const ebookSelect = {
  id: true,
  slug: true,
  title: true,
  author: true,
  description: true,
  isFree: true,
  pricePaise: true,
  coverKey: true,
  fileKey: true,
  fileSizeBytes: true,
  downloadsEnabled: true,
  active: true,
} satisfies Prisma.EbookSelect;

type EbookRow = Prisma.EbookGetPayload<{ select: typeof ebookSelect }>;

/** A book as a reader sees it, with what they can do. */
export type EbookView = {
  id: number;
  slug: string;
  title: string;
  author: string | null;
  description: string;
  isFree: boolean;
  pricePaise: number;
  cover: string | null;
  fileSizeBytes: number | null;
  access: EbookAccess;
  /** Downloads of this book are paused for everyone (switch off or no file). */
  paused: boolean;
  owned: boolean;
  /** Set only on the book page: the viewer's unpaid order (QR or bank transfer) holding this book. */
  awaitingPaymentOrderId: string | null;
};

function toView(
  row: EbookRow,
  viewer: EbookViewer,
  owned: boolean,
  siteDownloads: boolean,
): EbookView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    author: row.author,
    description: row.description,
    isFree: row.isFree,
    pricePaise: row.pricePaise,
    cover: row.coverKey ? ebookCoverSrc(row.id, row.coverKey) : null,
    fileSizeBytes: row.fileSizeBytes,
    access: ebookAccess({
      signedIn: viewer !== null,
      isAdmin: viewer?.role === "admin",
      isFree: row.isFree,
      active: row.active,
      owned,
      hasFile: row.fileKey !== null,
      siteDownloads,
      bookDownloads: row.downloadsEnabled,
    }),
    paused: downloadsPaused(row, siteDownloads),
    owned,
    awaitingPaymentOrderId: null,
  };
}

async function siteDownloadsOn(): Promise<boolean> {
  return (await getSetting("ebooks.downloads")).enabled;
}

/** Active books for /ebooks, in the admin's order. */
export async function listEbooks(viewer: EbookViewer): Promise<EbookView[]> {
  const [rows, site] = await Promise.all([
    db.ebook.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
      select: ebookSelect,
    }),
    siteDownloadsOn(),
  ]);
  const owned = viewer ? await ownedEbookIds(viewer.id, rows.map((row) => row.id)) : new Set<number>();
  return rows.map((row) => toView(row, viewer, owned.has(row.id), site));
}

/**
 * One book by slug for /ebooks/[slug]. Hidden books are shown only to their
 * buyers (so they can still download) and admins; null otherwise.
 */
export async function getEbookBySlug(slug: string, viewer: EbookViewer): Promise<EbookView | null> {
  const row = await db.ebook.findUnique({ where: { slug }, select: ebookSelect });
  if (!row) return null;
  const owned = viewer ? (await ownedEbookIds(viewer.id, [row.id])).has(row.id) : false;
  if (!row.active && !owned && viewer?.role !== "admin") return null;
  const view = toView(row, viewer, owned, await siteDownloadsOn());
  if (viewer && !owned && view.access === "buy") {
    const awaiting = await db.order.findFirst({
      where: { userId: viewer.id, status: "pending_payment", items: { some: { kind: "ebook", ebookId: row.id } } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    view.awaitingPaymentOrderId = awaiting?.id ?? null;
  }
  return view;
}

/** Books the user bought, newest purchase first, for "My ebooks" on /account. */
export async function listOwnedEbooks(viewer: NonNullable<EbookViewer>): Promise<EbookView[]> {
  const lines = await db.orderItem.findMany({
    where: { ...ownedLineWhere(viewer.id), ebookId: { not: null } },
    orderBy: { order: { paidAt: "desc" } },
    select: { ebookId: true },
  });
  const ids = [...new Set(lines.flatMap((line) => (line.ebookId === null ? [] : [line.ebookId])))];
  if (ids.length === 0) return [];
  const [rows, site] = await Promise.all([
    db.ebook.findMany({ where: { id: { in: ids } }, select: ebookSelect }),
    siteDownloadsOn(),
  ]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toView(row, viewer, true, site)] : [];
  });
}

/**
 * The ebooks on one of the user's orders, as they see them now (owned only
 * once the order is paid and not cancelled), in the order's line order.
 */
export async function readOrderEbooks(
  viewer: NonNullable<EbookViewer>,
  ebookIds: readonly number[],
): Promise<EbookView[]> {
  if (ebookIds.length === 0) return [];
  const [rows, owned, site] = await Promise.all([
    db.ebook.findMany({ where: { id: { in: [...ebookIds] } }, select: ebookSelect }),
    ownedEbookIds(viewer.id, ebookIds),
    siteDownloadsOn(),
  ]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ebookIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toView(row, viewer, owned.has(id), site)] : [];
  });
}

// ─── Downloads ──────────────────────────────────────────────────────────────

export type EbookDownload =
  | { ok: true; file: StoredFile; fileName: string }
  | { ok: false; error: "not_found" | "rate_limited"; retryAfterSeconds?: number };

/**
 * The book's file for this viewer, or why not. Every refusal other than the
 * rate limit is "not_found", so the route never says which rule failed.
 * Each allowed request counts against the per-user download limit.
 */
export async function openEbookDownload(
  ebookId: number,
  viewer: EbookViewer,
): Promise<EbookDownload> {
  if (!viewer) return { ok: false, error: "not_found" };
  const book = await db.ebook.findUnique({
    where: { id: ebookId },
    select: { ...ebookSelect, fileName: true },
  });
  if (!book) return { ok: false, error: "not_found" };
  const owned = book.isFree ? false : (await ownedEbookIds(viewer.id, [book.id])).has(book.id);
  const view = toView(book, viewer, owned, await siteDownloadsOn());
  if (view.access !== "download" || !book.fileKey) return { ok: false, error: "not_found" };

  const limit = await hitRateLimit(rateLimitRules.ebookDownloadPerUser, viewer.id);
  if (!limit.allowed) {
    return { ok: false, error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds };
  }
  const file = await getStorage().get(book.fileKey);
  if (!file) {
    console.error(`[ebooks] file missing from storage: ebook ${book.id}`);
    return { ok: false, error: "not_found" };
  }
  return { ok: true, file, fileName: book.fileName ?? `${book.slug}.pdf` };
}

/**
 * A cover to serve. Covers aren't private (only the book file is), and a
 * buyer of a book hidden later still sees its cover on /account.
 */
export async function findServableCover(ebookId: number) {
  const book = await db.ebook.findUnique({
    where: { id: ebookId },
    select: { coverKey: true, coverContentType: true },
  });
  if (!book?.coverKey || !book.coverContentType) return null;
  return { fileKey: book.coverKey, contentType: book.coverContentType };
}
