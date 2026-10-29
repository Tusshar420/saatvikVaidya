# Readiness report: Saatvik Vaidya, 25 October 2026

QA check of the "Done means" list in the project brief. Checked on the
developer's computer against the code on `dev`. The Hostinger test address
was **not** opened by this check.

## Verdict

**The site is ready for team testing on the test address. It is not yet
proven ready to launch.** Nothing found puts 1 November at risk, but the
steps in "Still open" must be done in the next six days.

## Results

| Automatic check | Result |
| --- | --- |
| Type check, lint, production build | Pass |
| Unit tests | 934 of 934 pass |
| Browser tests, phone 375 px | 146 pass, 8 skipped on purpose, 1 slow test timed out under load (passes alone) |
| Browser tests, computer 1280 px | 154 pass, the same slow test timed out under load (passes alone) |
| Settings and quiz tests (run one at a time) | 27 pass, 1 skipped on purpose |
| QR / bank payment test | 2 of 2 pass |

The slow test is "Build Your Brand, several products, pay, My Brand" in
`brand.spec.ts`. It takes 25 s alone and hit its 60 s limit when the Mac was
busy with other work. It is not a site fault.

## The Done list

| Done means | Status | Evidence and what is left |
| --- | --- | --- |
| Test address is live today and only the team can open it | **Open** | Not checked here. The lock (team user name and password on every page, site refuses to start if the password is missing) is covered by unit tests. Someone must open the test address in a private window and see the password box (TEST_PLAN 1.1, 1.2). The Hostinger package in `dist/hostinger` is from 05:18 today and **out of date**: rebuild it with `scripts/package_for_hostinger.sh` after the last commits. |
| Every account type can sign up, sign in and do its main job | **Met locally** | Doctor (verify, Dr. Talk threads, create a course), regular buyer (shop, courses, orders), bulk buyer (Build Your Brand, proof, status), staff (orders, approvals, courses, quiz). All pass. |
| A test order can be placed and the QR payment details show correctly | **Met locally**, one part open | UPI ID, name, bank, account, IFSC, note, order number and QR image are correct; Mark as paid works. **Not tested:** scanning the QR in a real UPI app to see the right amount (TEST_PLAN 8.3). Real payment details must also be typed into Settings (S2). |
| Pages work on phone and computer, no broken pages or errors | **Met locally** | About 30 pages per account type, widths 360 to 1280 px, no errors, no sideways scroll, no accessibility errors. Real phones, Safari and Firefox not tried. |
| All problems found are fixed and re-checked | **Met locally** | BUG-001 to BUG-008 are Re-checked. BUG-008 was reopened: the first fix did not work (the `/launch` page was 80 px too wide in every full phone run). Now fixed and the width test passes. BUG-005 was re-checked by unit test only. The team's own findings (BUG-009 on) are not in yet. |
| Test accounts and orders cleared before launch | **Ready, not run** | `pnpm db:clear-test-data` exists. It refuses any database without "test" or "staging" in its name and the live settings, keeps admins, catalogue, quizzes and content. Its unit tests pass (dry run changes nothing; delete keeps admins). QA did not run it. Run the dry run, then `--delete`, on 31 October (`docs/LAUNCH_1_NOVEMBER.md` section 3). |
| On 1 November the main address shows the full site and Coming soon is gone | **Ready, not rehearsed** | Steps, rollback and checks are written in `docs/LAUNCH_1_NOVEMBER.md`, `docs/COMING_SOON.md` and `docs/ACCESS_CONTROL.md`. Coming-soon page tests pass. |

## Still open

1. **Put the site on the test address** and run `docs/TEST_PLAN.md` there
   with real phones and browsers. Testing ends 29 October; last day to fix
   and re-check: 30 October (then the version is frozen).
2. **Rebuild the Hostinger package** (the one in `dist/` is old).
3. **Uncommitted wording changes.** Another session left edits in seven
   `src/content/` files and `docs/TEXT_CHANGES.md`. They are not committed.
   Tests and the build above ran with them in place and pass. Someone
   should read them and commit them, or drop them, before the package is
   built.
4. **Owner decisions** listed in `docs/LAUNCH_1_NOVEMBER.md` (due 29 October)
   and the real payment details for Settings.
5. **Scan the QR with a real UPI app** and stop before paying.
6. **Run the clear-test-data dry run on the test database** (31 October).
7. **Mac housekeeping.** An old `pnpm dev` (process 7481, port 3000) still
   runs and keeps a very large cache. Stop it by hand. The disk is at 77%.
   It was at 99% earlier today.

## Dates

- UI Complete (due 13 October) is overdue. The UI is built; this check found
  no UI fault left. The team's test on real devices is what remains.
- The brief says the public launch is 1 November. The project timeline lists
  the launch deadline as 6 November. Please confirm which one is right.
