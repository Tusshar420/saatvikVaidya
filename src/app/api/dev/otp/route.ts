import { z } from "zod";
import { toIndianE164 } from "@/lib/phone";
import { isDevOtpVisible } from "@/server/env";
import { latestDevOtp } from "@/server/notify/dev-outbox";

// Dev only: the latest OTP sent to a phone, for the dev banner in the sign-in
// UI. 404 unless NODE_ENV isn't production and DEV_SHOW_OTP=true.
// GET /api/dev/otp?phone=9876543210

export const dynamic = "force-dynamic";

const querySchema = z.object({ phone: z.string().max(32) });

export function GET(request: Request): Response {
  if (!isDevOtpVisible()) return new Response("Not found", { status: 404 });

  const query = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  const phoneNumber = query.success ? toIndianE164(query.data.phone) : null;
  if (!phoneNumber) {
    return Response.json({ error: "INVALID_PHONE_NUMBER" }, { status: 400 });
  }

  const otp = latestDevOtp(phoneNumber);
  return Response.json(
    {
      otp: otp && {
        code: otp.code,
        purpose: otp.purpose,
        expiresAt: otp.expiresAt.toISOString(),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
