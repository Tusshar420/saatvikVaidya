import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { brandLogoUpload } from "@/lib/brand";
import { MAX_BRAND_PROFILES } from "@/lib/label";
import { fieldErrorsOf } from "@/server/admin/form";
import { db } from "@/server/db";
import { deleteFilesQuietly, getStorage, newFileKey } from "@/server/storage";
import { checkUpload, cleanFileName } from "@/server/storage/files";
import { profileSchema, type ProfileInput } from "./packaging";

// Saved brand profiles: the brand details (name, logo, colours, contact,
// licences, short and long description) a user reuses on Launch orders, like
// saved delivery addresses. Everything is scoped by userId: someone else's
// profile id is "not found". Callers check the session and pass the
// signed-in user's id.

export type ProfileLogo = { name: string; contentType: string; sizeBytes: number };

export type BrandProfileView = ProfileInput & {
  id: number;
  isDefault: boolean;
  logo: ProfileLogo | null;
  updatedAt: Date;
};

const profileSelect = {
  id: true,
  isDefault: true,
  profileName: true,
  brandName: true,
  tagline: true,
  shortDescription: true,
  longDescription: true,
  marketedByName: true,
  marketedByAddress: true,
  contactPhone: true,
  licenceNumbers: true,
  primaryColour: true,
  secondaryColour: true,
  logoKey: true,
  logoName: true,
  logoContentType: true,
  logoSizeBytes: true,
  updatedAt: true,
} satisfies Prisma.BrandProfileSelect;

export type ProfileRow = Prisma.BrandProfileGetPayload<{ select: typeof profileSelect }>;

export function toProfileView(row: ProfileRow): BrandProfileView {
  const { logoKey, logoName, logoContentType, logoSizeBytes, ...rest } = row;
  return {
    ...rest,
    logo:
      logoKey && logoName && logoContentType && logoSizeBytes !== null
        ? { name: logoName, contentType: logoContentType, sizeBytes: logoSizeBytes }
        : null,
  };
}

/** The user's profiles: the default first, then oldest first. */
export async function listProfiles(
  userId: string,
  client: Prisma.TransactionClient = db,
): Promise<BrandProfileView[]> {
  const rows = await client.brandProfile.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    select: profileSelect,
  });
  return rows.map(toProfileView);
}

export async function readProfile(
  userId: string,
  profileId: number,
  client: Prisma.TransactionClient = db,
): Promise<BrandProfileView | null> {
  const row = await client.brandProfile.findFirst({ where: { id: profileId, userId }, select: profileSelect });
  return row ? toProfileView(row) : null;
}

export type ProfileResult =
  | { ok: true; id: number }
  | { ok: false; error: "not_found" | "too_many" }
  | { ok: false; error: "invalid"; fieldErrors: Record<string, string> };

/** A change to a profile makes the orders in progress that use it confirm their labels again. */
async function reconfirm(tx: Prisma.TransactionClient, profileId: number): Promise<void> {
  await tx.brandDraft.updateMany({ where: { profileId }, data: { packagingDone: false } });
}

/** Saves a new profile. The first one is the default; `makeDefault` makes this one the default. */
export async function createProfile(
  userId: string,
  values: Record<string, string>,
  options: { makeDefault?: boolean } = {},
): Promise<ProfileResult> {
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error) };
  return db.$transaction(async (tx) => {
    // Locks the user's profiles, so two saves can't both pass the limit.
    await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;
    const count = await tx.brandProfile.count({ where: { userId } });
    if (count >= MAX_BRAND_PROFILES) return { ok: false, error: "too_many" } as const;
    const isDefault = count === 0 || options.makeDefault === true;
    if (isDefault) await tx.brandProfile.updateMany({ where: { userId }, data: { isDefault: false } });
    const row = await tx.brandProfile.create({
      data: { ...parsed.data, userId, isDefault },
      select: { id: true },
    });
    return { ok: true, id: row.id } as const;
  });
}

export async function updateProfile(
  userId: string,
  profileId: number,
  values: Record<string, string>,
): Promise<ProfileResult> {
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error) };
  return db.$transaction(async (tx) => {
    const updated = await tx.brandProfile.updateMany({ where: { id: profileId, userId }, data: parsed.data });
    if (updated.count === 0) return { ok: false, error: "not_found" } as const;
    await reconfirm(tx, profileId);
    return { ok: true, id: profileId } as const;
  });
}

/** Makes one profile the default (and the others not). */
export async function setDefaultProfile(userId: string, profileId: number): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const own = await tx.brandProfile.findFirst({ where: { id: profileId, userId }, select: { id: true } });
    if (!own) return false;
    await tx.brandProfile.updateMany({ where: { userId }, data: { isDefault: false } });
    await tx.brandProfile.update({ where: { id: profileId }, data: { isDefault: true } });
    return true;
  });
}

/**
 * Removes a profile and its logo file. Orders already placed keep their own
 * copy. If it was the default, the oldest remaining profile becomes the
 * default; an order in progress that used it has to pick another.
 */
export async function deleteProfile(userId: string, profileId: number): Promise<boolean> {
  const logoKey = await db.$transaction(async (tx) => {
    const row = await tx.brandProfile.findFirst({
      where: { id: profileId, userId },
      select: { isDefault: true, logoKey: true },
    });
    if (!row) return undefined;
    await reconfirm(tx, profileId);
    await tx.brandProfile.delete({ where: { id: profileId } });
    if (row.isDefault) {
      const next = await tx.brandProfile.findFirst({
        where: { userId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      if (next) await tx.brandProfile.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return row.logoKey;
  });
  if (logoKey === undefined) return false;
  if (logoKey) await deleteFilesQuietly([logoKey]);
  return true;
}

/**
 * The profile an order in progress uses: the one picked, else the user's
 * default. Null when the user has none.
 */
export function chosenProfile(
  profiles: BrandProfileView[],
  draft: { profileId: number | null } | null,
): BrandProfileView | null {
  return (
    profiles.find((profile) => profile.id === draft?.profileId) ??
    profiles.find((profile) => profile.isDefault) ??
    null
  );
}

/** Picks the profile for the order in progress (an order starts only once there is a cart). */
export async function chooseProfile(userId: string, profileId: number): Promise<boolean> {
  const own = await db.brandProfile.findFirst({ where: { id: profileId, userId }, select: { id: true } });
  if (!own) return false;
  await db.brandDraft.upsert({
    where: { userId },
    create: { userId, profileId },
    update: { profileId, packagingDone: false },
  });
  return true;
}

// ─── Logo ───────────────────────────────────────────────────────────────────

export type LogoUploadError = "noProfile" | "empty" | "tooLarge" | "fileType";

class ProfileGone extends Error {}

/**
 * Stores a profile's logo (PNG, JPEG or PDF, checked from its bytes) and
 * removes the one it replaces. The file is written first; if the database
 * step fails it is removed again.
 */
export async function saveProfileLogo(options: {
  userId: string;
  profileId: number;
  fileName: string;
  bytes: Uint8Array;
}): Promise<{ ok: true; logo: ProfileLogo } | { ok: false; error: LogoUploadError }> {
  const checked = checkUpload(options.bytes, brandLogoUpload);
  if (!checked.ok) return checked;
  const own = await db.brandProfile.findFirst({
    where: { id: options.profileId, userId: options.userId },
    select: { id: true },
  });
  if (!own) return { ok: false, error: "noProfile" };

  const fileKey = newFileKey("brand-logos", options.userId, checked.extension);
  await getStorage().put(fileKey, options.bytes);
  const logo: ProfileLogo = {
    name: cleanFileName(options.fileName, checked.extension),
    contentType: checked.contentType,
    sizeBytes: options.bytes.byteLength,
  };
  let replaced: string | null = null;
  try {
    replaced = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ logoKey: string | null }[]>`
        SELECT logoKey FROM BrandProfile WHERE id = ${options.profileId} AND userId = ${options.userId} FOR UPDATE`;
      if (rows.length === 0) throw new ProfileGone();
      await tx.brandProfile.update({
        where: { id: options.profileId },
        data: {
          logoKey: fileKey,
          logoName: logo.name,
          logoContentType: logo.contentType,
          logoSizeBytes: logo.sizeBytes,
        },
      });
      await reconfirm(tx, options.profileId);
      return rows[0]!.logoKey;
    });
  } catch (error) {
    await deleteFilesQuietly([fileKey]);
    if (error instanceof ProfileGone) return { ok: false, error: "noProfile" };
    throw error;
  }
  if (replaced) await deleteFilesQuietly([replaced]);
  return { ok: true, logo };
}

/** A profile's logo file (key and type), for serving it to its owner. */
export async function profileLogoFile(userId: string, profileId: number) {
  const row = await db.brandProfile.findFirst({
    where: { id: profileId, userId },
    select: { logoKey: true, logoName: true, logoContentType: true },
  });
  if (!row?.logoKey || !row.logoName || !row.logoContentType) return null;
  return { key: row.logoKey, name: row.logoName, contentType: row.logoContentType };
}
