import { z } from "zod";
import { toIndianE164 } from "@/lib/phone";
import { sitePathSchema } from "@/server/content/home-schema";
import { isPlaceholderEmail } from "./placeholder-email";

// Zod shapes for every auth request body we accept. The policy plugin checks
// each request against these before Better Auth sees it; unknown keys
// (such as `role`) are refused.

/** Any common way of writing an Indian mobile, turned into "+91XXXXXXXXXX". */
export const phoneNumberSchema = z
  .string()
  .max(32)
  .transform((value, ctx) => {
    const e164 = toIndianE164(value);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "INVALID_PHONE_NUMBER" });
      return z.NEVER;
    }
    return e164;
  });

export const otpCodeSchema = z.string().regex(/^\d{6}$/);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(191)
  .pipe(z.email({ message: "INVALID_EMAIL" }));

/** Emails people can register: not on the reserved placeholder domain. */
const newEmailSchema = emailSchema.refine(
  (email) => !isPlaceholderEmail(email),
  { message: "INVALID_EMAIL" },
);

export const nameSchema = z.string().trim().min(2).max(80);

// Length and common-password rules are checked separately so they get their
// own error codes; this only caps the size of what we hash.
const passwordSchema = z.string().min(1).max(1024);

export const registrationFields = {
  name: nameSchema,
  userTypeId: z.number().int().positive(),
  termsAccepted: z.literal(true, { message: "TERMS_NOT_ACCEPTED" }),
  marketingOptIn: z.boolean().default(false),
};

/** What a new account needs, from either sign-up route. */
export const registrationSchema = z.object(registrationFields);

export type RegistrationInput = z.infer<typeof registrationSchema>;

const rememberMe = z.boolean().optional();
const callbackURL = sitePathSchema.optional();

export const authBodySchemas = {
  "/sign-up/email": z.strictObject({
    ...registrationFields,
    email: newEmailSchema,
    password: passwordSchema,
    callbackURL,
    rememberMe,
  }),
  "/sign-in/email": z.strictObject({
    email: emailSchema,
    password: passwordSchema,
    callbackURL,
    rememberMe,
  }),
  "/sign-in/phone-number": z.strictObject({
    phoneNumber: phoneNumberSchema,
    password: passwordSchema,
    rememberMe,
  }),
  "/phone-number/send-otp": z.strictObject({
    phoneNumber: phoneNumberSchema,
  }),
  // Registration fields are only needed (and only checked) when the number
  // has no account yet; see the policy plugin.
  "/phone-number/verify": z.strictObject({
    phoneNumber: phoneNumberSchema,
    code: otpCodeSchema,
    name: z.unknown().optional(),
    userTypeId: z.unknown().optional(),
    termsAccepted: z.unknown().optional(),
    marketingOptIn: z.unknown().optional(),
  }),
  "/phone-number/request-password-reset": z.strictObject({
    phoneNumber: phoneNumberSchema,
  }),
  "/phone-number/reset-password": z.strictObject({
    phoneNumber: phoneNumberSchema,
    otp: otpCodeSchema,
    newPassword: passwordSchema,
  }),
  "/request-password-reset": z.strictObject({
    email: emailSchema,
    redirectTo: sitePathSchema.optional(),
  }),
  "/send-verification-email": z.strictObject({
    email: emailSchema,
    callbackURL,
  }),
  "/reset-password": z.strictObject({
    token: z.string().min(1).max(512),
    newPassword: passwordSchema,
  }),
  "/change-password": z.strictObject({
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
    revokeOtherSessions: z.boolean().optional(),
  }),
  // Only these profile fields can be changed by the user. Role, user type,
  // verification status, phone and terms can't.
  "/update-user": z.strictObject({
    name: nameSchema.optional(),
    marketingOptIn: z.boolean().optional(),
  }),
} as const;

export type AuthPath = keyof typeof authBodySchemas;

export function isAuthPath(path: string | undefined): path is AuthPath {
  return path !== undefined && Object.hasOwn(authBodySchemas, path);
}
