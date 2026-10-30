import { describe, expect, it } from "vitest";
import { renderEmail, type EmailContent } from "./email";

const context = { baseUrl: "https://shop.example.test", phone: "+91 92203 58400" };

const order: EmailContent = {
  subject: "Your order SV-1 is confirmed",
  preheader: "We've received your payment.",
  greetName: "Asha",
  heading: "Payment received. Your order is confirmed!",
  footer: "order",
  blocks: [
    { kind: "steps", steps: ["Ordered", "Confirmed", "Shipped"], current: 1 },
    { kind: "text", text: "Thank you." },
    {
      kind: "items",
      title: "Order summary",
      rows: [{ name: "Triphala Churna", detail: "100 g · Qty 2", amount: "₹300" }],
      totals: [{ label: "Total paid", value: "₹380", strong: true }],
      footnote: "Prices include GST.",
    },
    { kind: "details", rows: [{ label: "Delivering to", value: "12 MG Road\nPune 411001" }] },
    { kind: "button", label: "View your order", href: "https://shop.example.test/orders/abc" },
  ],
};

describe("renderEmail", () => {
  it("writes a plain-text version with the greeting, summary, button link and footer", () => {
    const { text, subject } = renderEmail(order, context);
    expect(subject).toBe("Your order SV-1 is confirmed");
    expect(text.startsWith("Namaste Asha,")).toBe(true);
    expect(text).toContain("- Triphala Churna (100 g · Qty 2): ₹300");
    expect(text).toContain("Total paid: ₹380");
    expect(text).toContain("Delivering to: 12 MG Road, Pune 411001");
    expect(text).toContain("View your order: https://shop.example.test/orders/abc");
    expect(text).toContain("[x] Ordered  [>] Confirmed  [ ] Shipped");
    expect(text).toContain("+91 92203 58400");
    // Order emails say where to turn them off.
    expect(text).toContain("https://shop.example.test/account");
    // The first link in the text is the button (tests and mail apps rely on it).
    expect(/https?:\/\/\S+/.exec(text)?.[0]).toBe("https://shop.example.test/orders/abc");
  });

  it("writes HTML with the logo, the preheader, the tracker and the button, and attaches the logo", () => {
    const { html, attachments } = renderEmail(order, context);
    expect(html).toContain('src="cid:logo@saatvikvaidya"');
    expect(html).toContain("We&#39;ve received your payment.");
    expect(html).toContain('href="https://shop.example.test/orders/abc"');
    expect(html).toContain("Triphala Churna");
    expect(html).toContain("12 MG Road<br>Pune 411001");
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({ cid: "logo@saatvikvaidya", contentType: "image/jpeg" });
    expect(attachments[0]!.content.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  });

  it("escapes everything a customer could type", () => {
    const { html } = renderEmail(
      {
        ...order,
        greetName: '<script>alert("x")</script>',
        blocks: [
          { kind: "note", title: "Their comment", text: "<img src=x onerror=alert(1)>" },
          { kind: "button", label: "Open", href: 'https://shop.example.test/a"onclick="x' },
        ],
      },
      context,
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain('href="https://shop.example.test/a&quot;onclick=&quot;x"');
  });

  it("leaves out the greeting, sign-off and settings link on team emails", () => {
    const { text } = renderEmail({ ...order, greetName: undefined, footer: "staff" }, context);
    expect(text.startsWith("Payment received.")).toBe(true);
    expect(text).not.toContain("Team Saatvik Vaidya");
    expect(text).not.toContain("/account");
    expect(text).not.toContain("+91 92203 58400");
  });

  it("attaches inline images such as a QR code", () => {
    const qr = { cid: "qr-SV-1@saatvikvaidya", filename: "pay.png", content: Buffer.from("png"), contentType: "image/png" };
    const { html, attachments } = renderEmail(
      { ...order, blocks: [{ kind: "image", image: qr, alt: "UPI QR code", size: 180, caption: "Scan to pay" }] },
      context,
    );
    expect(html).toContain('src="cid:qr-SV-1@saatvikvaidya"');
    expect(attachments.map((image) => image.cid)).toEqual(["logo@saatvikvaidya", "qr-SV-1@saatvikvaidya"]);
  });
});
