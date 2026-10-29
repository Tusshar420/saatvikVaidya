import { cleanUpE2eData, e2eDb } from "./auth-helpers";

// Playwright's globalSetup and globalTeardown: removes the accounts, codes
// and rate-limit counters the sign-in tests made in the dev database. It runs
// before the tests too, for leftovers from a run that was stopped early.
export default async function cleanUp() {
  await cleanUpE2eData();
  await e2eDb().$disconnect();
}
