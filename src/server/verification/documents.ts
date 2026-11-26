import "server-only";
import { verification as copy } from "@/content/verification";
import type { Prisma } from "@/generated/prisma/client";
import {
  documentUpload,
  isDocumentType,
  requiredDocumentsFor,
  requiresPhoneFor,
  type DocumentType,
} from "@/lib/verification";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { db } from "@/server/db";
import {
  notifyAdminsOfUpload,
  sendDocumentReceived,
  sendVerificationDecision,
  type Recipient,
} from "@/server/notify/verification";
import { deleteFilesQuietly, getStorage, newFileKey } from "@/server/storage";
import { checkUpload, cleanFileName } from "@/server/storage/files";

// Professional verification: documents uploaded from /account, reviewed by
// admins, and the approve/reject decisions. Callers check the session first
// and pass the signed-in user's id; nothing here trusts the browser.

type Status = "none" | "pending" | "approved" | "rejected";
export type Decision = "approved" | "rejected";

/** Where a professional is in the flow, for the /account status card. */
export type VerificationState = "needed" | "review" | "approved" | "rejected";

export function verificationStateOf(
  status: Status,
  submittedAt: Date | null,
): VerificationState {
  if (status === "approved" || status === "rejected") return status;
  return submittedAt ? "review" : "needed";
}

export type DocumentView = {
  id: number;
  documentType: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: Date;
  verifiedAt: Date | null;
};

const documentSelect = {
  id: true,
  documentType: true,
  fileName: true,
  contentType: true,
  sizeBytes: true,
  uploadedAt: true,
  verifiedAt: true,
} satisfies Prisma.ProfessionalDocumentSelect;

export type DecisionView = {
  id: number;
  decision: Decision;
  comment: string | null;
  authorName: string | null;
  createdAt: Date;
};

export type ProfessionalVerification = {
  userId: string;
  name: string;
  userTypeKey: string;
  userTypeLabel: string;
  status: Status;
  submittedAt: Date | null;
  state: VerificationState;
  /** What this user type must upload, in order. */
  required: readonly DocumentType[];
  /** Current files, required ones first (in order), then any others. */
  documents: DocumentView[];
  /** Required documents not uploaded yet. */
  missing: DocumentType[];
  /**
   * For types that must give a phone number (null for the others): the
   * sign-in mobile if the account has one, else the contact number given
   * for verification (null until given).
   */
  phone: { number: string | null; fromSignIn: boolean } | null;
  /**
   * Set when the account is rejected: the reason from the latest decision
   * (null if none was given, or the status was set another way).
   */
  rejection: { comment: string | null } | null;
};

/**
 * The verification state of a professional whose type needs documents, or
 * null (no such user, or a type that needs no verification).
 */
export async function readProfessionalVerification(
  userId: string,
): Promise<ProfessionalVerification | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      verificationStatus: true,
      verificationSubmittedAt: true,
      phoneNumber: true,
      contactPhone: true,
      userType: {
        select: { key: true, label: true, requiresVerification: true },
      },
      documents: { select: documentSelect },
      verificationComments: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { decision: true, comment: true },
      },
    },
  });
  if (!user?.userType.requiresVerification) return null;
  const required = requiredDocumentsFor(user.userType.key);
  const latest = user.verificationComments[0];
  return {
    userId: user.id,
    name: user.name,
    userTypeKey: user.userType.key,
    userTypeLabel: user.userType.label,
    status: user.verificationStatus,
    submittedAt: user.verificationSubmittedAt,
    state: verificationStateOf(
      user.verificationStatus,
      user.verificationSubmittedAt,
    ),
    required,
    documents: sortDocuments(user.documents, required),
    missing: required.filter(
      (type) => !user.documents.some((doc) => doc.documentType === type),
    ),
    phone: requiresPhoneFor(user.userType.key)
      ? {
          number: user.phoneNumber ?? user.contactPhone,
          fromSignIn: user.phoneNumber !== null,
        }
      : null,
    rejection:
      user.verificationStatus === "rejected"
        ? { comment: latest?.decision === "rejected" ? latest.comment : null }
        : null,
  };
}

/**
 * Whether a professional has everything their type needs for review: each
 * required document, and a phone number if their type needs one.
 */
export function isSubmissionComplete(
  userTypeKey: string,
  uploaded: Iterable<string>,
  phone: { phoneNumber: string | null; contactPhone: string | null },
): boolean {
  const have = new Set(uploaded);
  return (
    requiredDocumentsFor(userTypeKey).every((type) => have.has(type)) &&
    (!requiresPhoneFor(userTypeKey) ||
      phone.phoneNumber !== null ||
      phone.contactPhone !== null)
  );
}

function sortDocuments(
  documents: DocumentView[],
  required: readonly DocumentType[],
): DocumentView[] {
  const rank = (type: string) => {
    const index = required.indexOf(type as DocumentType);
    return index === -1 ? required.length : index;
  };
  return [...documents].sort(
    (a, b) => rank(a.documentType) - rank(b.documentType) || a.id - b.id,
  );
}

export type ReviewDetail = ProfessionalVerification & {
  email: string | null;
  phoneNumber: string | null;
  /** Given for verification when there's no sign-in mobile; not checked. */
  contactPhone: string | null;
  createdAt: Date;
  history: DecisionView[];
};

/** Everything the admin review page shows about one professional. */
export async function readVerificationReview(
  userId: string,
): Promise<ReviewDetail | null> {
  const base = await readProfessionalVerification(userId);
  if (!base) return null;
  const [user, history] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        phoneNumber: true,
        contactPhone: true,
        createdAt: true,
      },
    }),
    readDecisionHistory(userId),
  ]);
  return {
    ...base,
    email: isPlaceholderEmail(user.email) ? null : user.email,
    phoneNumber: user.phoneNumber,
    contactPhone: user.contactPhone,
    createdAt: user.createdAt,
    history,
  };
}

/** Decisions about a user, newest first. */
export async function readDecisionHistory(
  userId: string,
  take = 50,
): Promise<DecisionView[]> {
  const rows = await db.verificationComment.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: { author: { select: { name: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    decision: row.decision,
    comment: row.comment,
    authorName: row.author?.name ?? null,
    createdAt: row.createdAt,
  }));
}

// ─── Upload ─────────────────────────────────────────────────────────────────

export type UploadError =
  | "notProfessional"
  | "locked"
  | "documentType"
  | "empty"
  | "tooLarge"
  | "fileType";

export type UploadResult =
  | { ok: true; document: DocumentView; complete: boolean }
  | { ok: false; error: UploadError };

/**
 * Saves a professional's document, replacing their previous file of the same
 * type. Once every required document is in, the account goes to "pending"
 * with a new submitted date (this is also how a rejected account is sent back
 * for review). Verified accounts can't change their documents.
 */
export async function uploadDocument(input: {
  userId: string;
  documentType: string;
  fileName: string;
  bytes: Uint8Array;
}): Promise<UploadResult> {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      verificationStatus: true,
      userType: {
        select: { key: true, label: true, requiresVerification: true },
      },
    },
  });
  if (!user?.userType.requiresVerification) {
    return { ok: false, error: "notProfessional" };
  }
  if (user.verificationStatus === "approved") {
    return { ok: false, error: "locked" };
  }
  const required = requiredDocumentsFor(user.userType.key);
  if (
    !isDocumentType(input.documentType) ||
    !required.includes(input.documentType)
  ) {
    return { ok: false, error: "documentType" };
  }
  const documentType = input.documentType;
  const checked = checkUpload(input.bytes, documentUpload);
  if (!checked.ok) return { ok: false, error: checked.error };

  const fileKey = newFileKey("documents", user.id, checked.extension);
  await getStorage().put(fileKey, input.bytes);

  let outcome:
    | { locked: true }
    | {
        locked: false;
        document: DocumentView;
        complete: boolean;
        replacedKey: string | null;
      };
  try {
    outcome = await db.$transaction(async (tx) => {
      // Lock the user row, so an admin decision can't land in between (and
      // an approval is never undone by an upload that started before it).
      const [row] = await tx.$queryRaw<
        {
          verificationStatus: Status;
          phoneNumber: string | null;
          contactPhone: string | null;
        }[]
      >`
        SELECT verificationStatus, phoneNumber, contactPhone FROM \`User\` WHERE id = ${user.id} FOR UPDATE`;
      if (!row || row.verificationStatus === "approved") {
        return { locked: true as const };
      }
      const previous = await tx.professionalDocument.findUnique({
        where: { userId_documentType: { userId: user.id, documentType } },
        select: { fileKey: true },
      });
      const values = {
        fileKey,
        fileName: cleanFileName(input.fileName, checked.extension),
        contentType: checked.contentType,
        sizeBytes: input.bytes.byteLength,
        uploadedAt: new Date(),
        verifiedAt: null,
      };
      const document = await tx.professionalDocument.upsert({
        where: { userId_documentType: { userId: user.id, documentType } },
        create: { userId: user.id, documentType, ...values },
        update: values,
        select: documentSelect,
      });
      const uploaded = await tx.professionalDocument.findMany({
        where: { userId: user.id },
        select: { documentType: true },
      });
      const complete = isSubmissionComplete(
        user.userType.key,
        uploaded.map((item) => item.documentType),
        row,
      );
      if (complete) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            verificationStatus: "pending",
            verificationSubmittedAt: new Date(),
          },
        });
      } else if (row.verificationStatus === "none") {
        await tx.user.update({
          where: { id: user.id },
          data: { verificationStatus: "pending" },
        });
      }
      return {
        locked: false as const,
        document,
        complete,
        replacedKey: previous?.fileKey ?? null,
      };
    });
  } catch (error) {
    await deleteFilesQuietly([fileKey]);
    throw error;
  }

  if (outcome.locked) {
    await deleteFilesQuietly([fileKey]);
    return { ok: false, error: "locked" };
  }
  if (outcome.replacedKey) await deleteFilesQuietly([outcome.replacedKey]);

  const label = copy.documentTypes[documentType].label;
  await sendQuietly(async () => {
    await sendDocumentReceived(user, label, outcome.complete);
    await notifyAdminsOfUpload(
      { ...user, userTypeLabel: user.userType.label },
      label,
      outcome.complete,
    );
  });
  return { ok: true, document: outcome.document, complete: outcome.complete };
}

// ─── Contact phone ──────────────────────────────────────────────────────────

export type ContactPhoneError = "notNeeded" | "locked";

/**
 * Saves the phone number a professional gives for verification (types that
 * need one, when the account has no sign-in mobile). Like an upload, it
 * sends the account for review once everything is in. `phone` is already
 * checked: "+91" and a valid mobile.
 */
export async function saveContactPhone(input: {
  userId: string;
  phone: string;
}): Promise<{ ok: true; complete: boolean } | { ok: false; error: ContactPhoneError }> {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      userType: {
        select: { key: true, label: true, requiresVerification: true },
      },
    },
  });
  if (
    !user?.userType.requiresVerification ||
    !requiresPhoneFor(user.userType.key) ||
    user.phoneNumber !== null
  ) {
    return { ok: false, error: "notNeeded" };
  }
  const outcome = await db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ verificationStatus: Status }[]>`
      SELECT verificationStatus FROM \`User\` WHERE id = ${user.id} FOR UPDATE`;
    if (!row || row.verificationStatus === "approved") return null;
    const uploaded = await tx.professionalDocument.findMany({
      where: { userId: user.id },
      select: { documentType: true },
    });
    const complete = isSubmissionComplete(
      user.userType.key,
      uploaded.map((item) => item.documentType),
      { phoneNumber: null, contactPhone: input.phone },
    );
    await tx.user.update({
      where: { id: user.id },
      data: {
        contactPhone: input.phone,
        ...(complete
          ? { verificationStatus: "pending", verificationSubmittedAt: new Date() }
          : row.verificationStatus === "none"
            ? { verificationStatus: "pending" }
            : {}),
      },
    });
    return { complete };
  });
  if (!outcome) return { ok: false, error: "locked" };

  if (outcome.complete) {
    const label = copy.phoneLabel;
    await sendQuietly(async () => {
      await sendDocumentReceived(user, label, true);
      await notifyAdminsOfUpload(
        { ...user, userTypeLabel: user.userType.label },
        label,
        true,
      );
    });
  }
  return { ok: true, complete: outcome.complete };
}

// ─── Viewing files ──────────────────────────────────────────────────────────

export type DocumentFile = {
  fileKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

/**
 * A document's file details if `viewer` may see it (its owner, or an admin),
 * otherwise null, the same as for a document that doesn't exist.
 */
export async function findViewableDocument(
  id: number,
  viewer: { id: string; role?: string | null },
): Promise<DocumentFile | null> {
  const document = await db.professionalDocument.findUnique({
    where: { id },
    select: {
      userId: true,
      fileKey: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
    },
  });
  if (!document) return null;
  if (document.userId !== viewer.id && viewer.role !== "admin") return null;
  return {
    fileKey: document.fileKey,
    fileName: document.fileName,
    contentType: document.contentType,
    sizeBytes: document.sizeBytes,
  };
}

// ─── Decisions ──────────────────────────────────────────────────────────────

/**
 * The verification side of an admin decision, inside the caller's
 * transaction: records it (with the comment) and marks the documents on
 * file as verified, or clears that mark on a rejection.
 */
export async function recordDecision(
  tx: Prisma.TransactionClient,
  entry: {
    userId: string;
    decision: Decision;
    comment: string | null;
    actorId: string;
  },
): Promise<void> {
  await tx.verificationComment.create({
    data: {
      userId: entry.userId,
      authorId: entry.actorId,
      decision: entry.decision,
      comment: entry.comment,
    },
  });
  await tx.professionalDocument.updateMany({
    where: { userId: entry.userId },
    data: { verifiedAt: entry.decision === "approved" ? new Date() : null },
  });
}

/** Tells each professional about the decision, after it's saved. */
export async function sendDecisions(
  users: Recipient[],
  decision: Decision,
  comment: string | null,
): Promise<void> {
  await sendQuietly(async () => {
    for (const user of users) {
      await sendVerificationDecision(user, decision, comment);
    }
  });
}

/** Storage keys of these users' documents (to delete with the users). */
export async function documentKeysOf(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await db.professionalDocument.findMany({
    where: { userId: { in: userIds } },
    select: { fileKey: true },
  });
  return rows.map((row) => row.fileKey);
}

/** A message that fails to send never undoes a saved change; it's logged. */
async function sendQuietly(send: () => Promise<void>): Promise<void> {
  try {
    await send();
  } catch (error) {
    console.error("[verification] couldn't send a notification", error);
  }
}
