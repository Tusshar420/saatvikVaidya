import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

// Every Better Auth endpoint: /api/auth/sign-in/email, /api/auth/phone-number/send-otp...
export const { GET, POST } = toNextJsHandler(auth);
