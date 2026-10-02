import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { placeholderEmailFor } from "@/server/auth/placeholder-email";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin, makeOrder } from "../../../tests/setup/orders";
import { csvCell, exportCsv, ordersCsv, rupees, toCsv, usersCsv } from "./export";

// CSV exports: cells that a spreadsheet could run are defused, the numbers
// match the orders, and every export is logged.

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const lines = (csv: string) => csv.replace(/^﻿/, "").trimEnd().split("\r\n");

describe("csvCell", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });

  it.each(["=SUM(A1)", "+91 98765", "-2+3", "@cmd", "\tTab", "\rReturn"])(
    "defuses %j so a spreadsheet won't run it",
    (value) => {
      expect(csvCell(value).replace(/^"/, "")).toMatch(/^'/);
    },
  );

  it("writes numbers, dates and blanks plainly", () => {
    expect(csvCell(42)).toBe("42");
    expect(csvCell(true)).toBe("true");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(new Date("2026-10-02T09:00:00Z"))).toBe("2026-10-02T09:00:00.000Z");
    expect(rupees(123_456)).toBe("1234.56");
  });

  it("starts the file with a BOM and ends rows with CRLF", () => {
    const csv = toCsv(["A", "B"], [[1, "x"]]);
    expect(csv).toBe("﻿A,B\r\n1,x\r\n");
  });
});

describe("orders and users CSV", () => {
  it("lists each order with amounts in rupees that match the order", async () => {
    const order = await makeOrder(db, { quantity: 3, address: { name: "=HYPERLINK(\"http://x\")" } });
    await makeOrder(db, { pay: false });
    const { csv, rows } = await ordersCsv();
    expect(rows).toBe(2);
    const stored = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    const row = lines(csv).find((line) => line.startsWith(stored.number));
    expect(row).toBeDefined();
    expect(row).toContain(`,${rupees(stored.totalPaise)}`);
    expect(row).toContain(",paid,");
    // The malicious name is neutralised, and the mobile has no "+".
    expect(row).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(row).toContain(",9876543210,");
    expect(lines(csv)[0]).toContain("Total (INR)");
  });

  it("leaves out orders outside the range", async () => {
    await makeOrder(db);
    const out = await ordersCsv({ from: "2020-01-01", to: "2020-01-02", by: "day" });
    expect(out.rows).toBe(0);
  });

  it("lists users without placeholder emails or the + in mobile numbers", async () => {
    await db.user.createMany({
      data: [
        {
          id: "csv-phone",
          name: "Phone Only",
          email: placeholderEmailFor("+919876500000"),
          phoneNumber: "+919876500000",
          userTypeId: (await db.userType.findUniqueOrThrow({ where: { key: "customer" } })).id,
          termsAcceptedAt: new Date(),
        },
        {
          id: "csv-formula",
          name: "+cmd|' /C calc'!A0",
          email: "formula@example.test",
          userTypeId: (await db.userType.findUniqueOrThrow({ where: { key: "doctor" } })).id,
          verificationStatus: "pending",
          termsAcceptedAt: new Date(),
        },
      ],
    });
    const { csv, rows } = await usersCsv();
    expect(rows).toBe(2);
    expect(csv).not.toContain("phone.saatvikvaidya.invalid");
    expect(csv).toContain("Phone Only,,,9876500000,");
    expect(csv).toContain("'+cmd|' /C calc'!A0");
    expect(csv).toContain("formula@example.test");
  });
});

describe("exportCsv", () => {
  it("logs who exported what, with the row count", async () => {
    const adminId = await makeAdmin(db);
    await makeOrder(db);
    const { fileName, csv } = await exportCsv(adminId, "orders", { from: "2026-01-01", to: "2030-01-01", by: "day" });
    expect(fileName).toBe("saatvik-vaidya-orders-2026-01-01_to_2030-01-01.csv");
    expect(lines(csv)).toHaveLength(2);
    const log = await db.adminLog.findFirstOrThrow({ where: { action: "export.orders" } });
    expect(log).toMatchObject({ userId: adminId, resource: "Export", resourceId: "orders" });
    expect(log.changes).toMatchObject({ note: "1 rows, 2026-01-01 to 2030-01-01" });
  });
});
