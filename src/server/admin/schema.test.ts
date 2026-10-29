import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { resetAuthData, userTypeIds } from "../../../tests/setup/auth";
import { getTableData, isHiddenColumn, isTableName } from "./schema";

beforeEach(async () => {
  await resetAuthData(db);
  const types = await userTypeIds(db);
  await db.user.create({
    data: {
      id: "db-user",
      name: "Db User",
      email: "db-user@example.test",
      userTypeId: types.customer,
      termsAcceptedAt: new Date(),
      accounts: {
        create: {
          id: "db-acc",
          accountId: "db-user",
          providerId: "credential",
          password: "secret-hash",
        },
      },
      sessions: {
        create: {
          id: "db-session",
          token: "secret-session-token",
          expiresAt: new Date(Date.now() + 60_000),
        },
      },
    },
  });
  await db.verification.create({
    data: {
      id: "db-ver",
      identifier: "reset-password:secret-reset-token",
      value: "db-user",
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("database browser", () => {
  it("only accepts real table names", async () => {
    expect(await isTableName("User")).toBe(true);
    expect(await isTableName("User`; DROP TABLE User; --")).toBe(false);
    expect(await isTableName("information_schema.TABLES")).toBe(false);
  });

  it("hides passwords, session tokens, codes and reset tokens", async () => {
    const rows = JSON.stringify([
      ...(await getTableData("Account")),
      ...(await getTableData("Session")),
      ...(await getTableData("Verification")),
    ]);
    expect(rows).not.toContain("secret-hash");
    expect(rows).not.toContain("secret-session-token");
    expect(rows).not.toContain("secret-reset-token");
    expect(rows).toContain("[hidden]");
    expect(isHiddenColumn("Account", "password")).toBe(true);
    expect(isHiddenColumn("User", "name")).toBe(false);
  });

  it("still shows ordinary columns", async () => {
    const [user] = await getTableData("User");
    expect(user).toMatchObject({ id: "db-user", name: "Db User" });
  });
});
