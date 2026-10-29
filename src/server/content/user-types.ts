import "server-only";
import { db } from "@/server/db";
import { cachedRead, contentTags } from "./cache";

/** A user type as the sign-up form needs it (JSON-safe for the cache). */
export type SignUpUserType = {
  id: number;
  key: string;
  label: string;
  requiresVerification: boolean;
};

/**
 * Active user types for the "I am a" choice, straight from the database:
 * Customer first, then by `sortOrder` (and id, so the order is stable).
 */
export async function readSignUpUserTypes(): Promise<SignUpUserType[]> {
  const types = await db.userType.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, key: true, label: true, requiresVerification: true },
  });
  const customer = types.filter((type) => type.key === "customer");
  return [...customer, ...types.filter((type) => type.key !== "customer")];
}

const cachedSignUpUserTypes = cachedRead(
  readSignUpUserTypes,
  "user-types:sign-up",
  contentTags.userTypes,
);

/**
 * The cached list for the site shell. If the database can't be reached it
 * logs and returns an empty list; the register step then says sign-up isn't
 * available, and the rest of the site still renders.
 */
export async function getSignUpUserTypes(): Promise<SignUpUserType[]> {
  try {
    return await cachedSignUpUserTypes();
  } catch (error) {
    console.error("getSignUpUserTypes: user types unavailable.", error);
    return [];
  }
}
