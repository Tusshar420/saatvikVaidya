import "server-only";
import { emails as copy } from "@/content/emails";
import { emailLogoBase64 } from "./email-logo";

// The look of every email, like a big shop's order mails: the logo, a
// heading, an order tracker, an item table with totals, one clear button and
// a footer with our phone number. An email is described once as blocks and
// rendered twice: as HTML and as plain text (shown by mail apps that block
// HTML, and printed by the dev sender).
//
// Email apps ignore CSS variables and <style> sheets, so the colours below
// are written out inline. They are the DESIGN.md tokens, nothing new.

const palette = {
  brand: "#063f36", // brand
  brandSoft: "#e8f2ec", // brand-soft
  orange: "#f36c21", // orange
  orangeStrong: "#c2540a", // orange-strong (white text on it)
  orangeSoft: "#fff0e7", // orange-soft
  orangeInk: "#a8470a", // orange-ink
  danger: "#c6411b", // danger
  ink: "#14231f", // ink
  muted: "#5f6d68", // muted
  line: "#e2e5e3", // line on white (rgb(20 35 31 / 0.12) flattened)
  track: "#e5e9e6", // track
  surface: "#ffffff", // surface
  cream: "#f8f5ed", // cream
} as const;

const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type InlineImage = {
  /** Referenced as src="cid:<cid>" in the HTML. */
  cid: string;
  filename: string;
  content: Buffer;
  contentType: string;
};

export type EmailRow = { label: string; value: string };

export type EmailBlock =
  | { kind: "text"; text: string }
  /** A tinted box: "brand" for good news and next steps, "warning" for problems. */
  | { kind: "note"; title?: string; text: string; tone?: "brand" | "warning" }
  /** Label and value pairs; a value may hold line breaks (an address). */
  | { kind: "details"; title?: string; rows: EmailRow[] }
  | {
      kind: "items";
      title?: string;
      rows: { name: string; detail?: string; amount?: string }[];
      totals?: { label: string; value: string; strong?: boolean }[];
      footnote?: string;
    }
  /** The order tracker. `current` is the step reached; `problem` paints it red. */
  | { kind: "steps"; steps: readonly string[]; current: number; problem?: boolean }
  | { kind: "button"; label: string; href: string }
  | { kind: "image"; image: InlineImage; alt: string; size: number; caption?: string };

export type EmailContent = {
  subject: string;
  /** The grey line mail apps show after the subject in the inbox. */
  preheader?: string;
  /** For "Namaste <name>,". Left out on emails to the team. */
  greetName?: string;
  heading: string;
  blocks: EmailBlock[];
  /** Which footer: order emails link to the settings that turn them off. */
  footer: "order" | "account" | "staff";
};

export type EmailContext = {
  /** The site's address, e.g. https://saatvikvaidya.com */
  baseUrl: string;
  /** The support phone number from the settings. */
  phone: string;
};

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
  attachments: InlineImage[];
};

const logoCid = "logo@saatvikvaidya";

function logoImage(): InlineImage {
  return {
    cid: logoCid,
    filename: "saatvik-vaidya.jpg",
    content: Buffer.from(emailLogoBase64, "base64"),
    contentType: "image/jpeg",
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped text with its line breaks kept. */
function lines(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

// ─── Plain text ─────────────────────────────────────────────────────────────

function textBlock(block: EmailBlock): string {
  switch (block.kind) {
    case "text":
      return block.text;
    case "note":
      return [block.title, block.text].filter(Boolean).join("\n");
    case "details":
      return [
        ...(block.title ? [block.title] : []),
        ...block.rows.map((row) => `${row.label}: ${row.value.replace(/\r?\n/g, ", ")}`),
      ].join("\n");
    case "items":
      return [
        ...(block.title ? [block.title] : []),
        ...block.rows.map(
          (row) => `- ${row.name}${row.detail ? ` (${row.detail})` : ""}${row.amount ? `: ${row.amount}` : ""}`,
        ),
        ...(block.totals?.length ? [""] : []),
        ...(block.totals ?? []).map((row) => `${row.label}: ${row.value}`),
        ...(block.footnote ? [block.footnote] : []),
      ].join("\n");
    case "steps":
      return block.steps
        .map((step, index) => (index < block.current ? `[x] ${step}` : index === block.current ? `[>] ${step}` : `[ ] ${step}`))
        .join("  ");
    case "button":
      return `${block.label}: ${block.href}`;
    case "image":
      return block.caption ?? "";
  }
}

function renderText(content: EmailContent, context: EmailContext): string {
  const parts: string[] = [];
  if (content.greetName !== undefined) parts.push(copy.layout.greeting(content.greetName));
  parts.push(content.heading);
  for (const block of content.blocks) {
    const text = textBlock(block);
    if (text) parts.push(text);
  }
  if (content.footer !== "staff") parts.push(`${copy.layout.signOff}\n${copy.layout.team}`);
  // The team doesn't need our own phone number.
  const footer = [...(content.footer === "staff" ? [] : [copy.layout.help(context.phone)]), reasonFor(content.footer)];
  if (content.footer === "order") footer.push(`${copy.layout.manage}: ${new URL("/account", context.baseUrl).toString()}`);
  parts.push(`--\n${footer.join("\n")}`);
  return parts.join("\n\n");
}

function reasonFor(footer: EmailContent["footer"]): string {
  if (footer === "order") return copy.layout.orderReason;
  if (footer === "staff") return copy.layout.staffReason;
  return copy.layout.accountReason;
}

// ─── HTML ───────────────────────────────────────────────────────────────────

const p = (style: string) => `margin:0;font-family:${font};${style}`;

function sectionTitle(title: string | undefined): string {
  return title
    ? `<p style="${p(`font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${palette.muted};padding:0 0 8px;`)}">${escapeHtml(title)}</p>`
    : "";
}

function htmlSteps(block: Extract<EmailBlock, { kind: "steps" }>): string {
  const width = Math.floor(100 / block.steps.length);
  // The last step reached (delivered) is a finish, not a step in progress.
  const finished = !block.problem && block.current >= block.steps.length - 1;
  const bars = block.steps
    .map((_, index) => {
      const colour =
        index < block.current || (finished && index === block.current)
          ? palette.brand
          : index === block.current
            ? block.problem
              ? palette.danger
              : palette.orange
            : palette.track;
      return `<td width="${width}%" style="padding:0 2px;"><div style="height:6px;line-height:6px;font-size:0;border-radius:3px;background:${colour};">&nbsp;</div></td>`;
    })
    .join("");
  const labels = block.steps
    .map((step, index) => {
      const reached = index <= block.current;
      const colour = index === block.current && block.problem ? palette.danger : reached ? palette.ink : palette.muted;
      return `<td width="${width}%" valign="top" style="padding:6px 2px 0;font-family:${font};font-size:11px;line-height:14px;color:${colour};font-weight:${index === block.current ? 700 : 400};">${escapeHtml(step)}</td>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${bars}</tr><tr>${labels}</tr></table>`;
}

function htmlBlock(block: EmailBlock): string {
  switch (block.kind) {
    case "text":
      return `<p style="${p(`font-size:15px;line-height:23px;color:${palette.ink};`)}">${lines(block.text)}</p>`;
    case "note": {
      const warning = block.tone === "warning";
      const background = warning ? palette.orangeSoft : palette.brandSoft;
      const colour = warning ? palette.orangeInk : palette.brand;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${background};border-radius:10px;padding:14px 16px;">${
        block.title
          ? `<p style="${p(`font-size:15px;line-height:21px;font-weight:700;color:${colour};padding:0 0 4px;`)}">${escapeHtml(block.title)}</p>`
          : ""
      }<p style="${p(`font-size:14px;line-height:21px;color:${palette.ink};`)}">${lines(block.text)}</p></td></tr></table>`;
    }
    case "details": {
      const rows = block.rows
        .map(
          (row, index) =>
            `<tr><td valign="top" style="padding:8px 12px 8px 0;${index ? `border-top:1px solid ${palette.line};` : ""}font-family:${font};font-size:13px;line-height:19px;color:${palette.muted};width:38%;">${escapeHtml(row.label)}</td><td valign="top" style="padding:8px 0;${index ? `border-top:1px solid ${palette.line};` : ""}font-family:${font};font-size:14px;line-height:20px;color:${palette.ink};font-weight:600;word-break:break-word;">${lines(row.value)}</td></tr>`,
        )
        .join("");
      return `${sectionTitle(block.title)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
    }
    case "items": {
      const rows = block.rows
        .map(
          (row) =>
            `<tr><td valign="top" style="padding:10px 12px 10px 0;border-top:1px solid ${palette.line};font-family:${font};"><div style="font-size:14px;line-height:20px;font-weight:600;color:${palette.ink};">${escapeHtml(row.name)}</div>${
              row.detail
                ? `<div style="font-size:13px;line-height:18px;color:${palette.muted};padding-top:2px;">${escapeHtml(row.detail)}</div>`
                : ""
            }</td><td valign="top" align="right" style="padding:10px 0;border-top:1px solid ${palette.line};font-family:${font};font-size:14px;line-height:20px;color:${palette.ink};white-space:nowrap;">${escapeHtml(row.amount ?? "")}</td></tr>`,
        )
        .join("");
      const totals = (block.totals ?? [])
        .map(
          (row, index) =>
            `<tr><td style="padding:${index ? 4 : 12}px 12px 4px 0;${index ? "" : `border-top:2px solid ${palette.line};`}font-family:${font};font-size:${row.strong ? 16 : 14}px;line-height:22px;color:${row.strong ? palette.ink : palette.muted};font-weight:${row.strong ? 800 : 400};">${escapeHtml(row.label)}</td><td align="right" style="padding:${index ? 4 : 12}px 0 4px;${index ? "" : `border-top:2px solid ${palette.line};`}font-family:${font};font-size:${row.strong ? 16 : 14}px;line-height:22px;color:${palette.ink};font-weight:${row.strong ? 800 : 600};white-space:nowrap;">${escapeHtml(row.value)}</td></tr>`,
        )
        .join("");
      const footnote = block.footnote
        ? `<tr><td colspan="2" style="padding:6px 0 0;font-family:${font};font-size:12px;line-height:17px;color:${palette.muted};">${escapeHtml(block.footnote)}</td></tr>`
        : "";
      return `${sectionTitle(block.title)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}${totals}${footnote}</table>`;
    }
    case "steps":
      return htmlSteps(block);
    case "button":
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${palette.orangeStrong}" style="border-radius:999px;"><a href="${escapeHtml(block.href)}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:${font};font-size:15px;line-height:20px;font-weight:700;color:${palette.surface};text-decoration:none;border-radius:999px;">${escapeHtml(block.label)}</a></td></tr></table>`;
    case "image":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><img src="cid:${escapeHtml(block.image.cid)}" width="${block.size}" height="${block.size}" alt="${escapeHtml(block.alt)}" style="display:block;width:${block.size}px;height:${block.size}px;border:1px solid ${palette.line};border-radius:8px;background:${palette.surface};"></td></tr>${
        block.caption
          ? `<tr><td align="center" style="padding-top:8px;font-family:${font};font-size:13px;line-height:18px;color:${palette.muted};">${escapeHtml(block.caption)}</td></tr>`
          : ""
      }</table>`;
  }
}

function renderHtml(content: EmailContent, context: EmailContext): string {
  const body = content.blocks
    .map((block) => `<tr><td style="padding:0 0 20px;">${htmlBlock(block)}</td></tr>`)
    .join("");
  const greeting =
    content.greetName !== undefined
      ? `<p style="${p(`font-size:15px;line-height:22px;color:${palette.muted};padding:0 0 6px;`)}">${escapeHtml(copy.layout.greeting(content.greetName))}</p>`
      : "";
  const signOff =
    content.footer !== "staff"
      ? `<tr><td style="padding:4px 0 0;"><p style="${p(`font-size:15px;line-height:22px;color:${palette.ink};`)}">${escapeHtml(copy.layout.signOff)}<br><strong>${escapeHtml(copy.layout.team)}</strong></p></td></tr>`
      : "";
  const manage =
    content.footer === "order"
      ? ` <a href="${escapeHtml(new URL("/account", context.baseUrl).toString())}" style="color:${palette.brand};text-decoration:underline;">${escapeHtml(copy.layout.manage)}</a>`
      : "";
  const help =
    content.footer !== "staff"
      ? `<p style="${p(`font-size:14px;line-height:20px;font-weight:700;color:${palette.brand};padding-bottom:6px;`)}">${escapeHtml(copy.layout.help(context.phone))}</p>`
      : "";
  const home = escapeHtml(context.baseUrl);
  const preheader = content.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(content.preheader)}${"&#8199;&#65279;&#847; ".repeat(20)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${palette.cream};-webkit-text-size-adjust:100%;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${palette.cream};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${palette.surface};border-radius:16px;overflow:hidden;border:1px solid ${palette.line};">
<tr><td style="padding:18px 24px 14px;border-bottom:3px solid ${palette.orange};">
<a href="${home}" target="_blank" style="text-decoration:none;"><img src="cid:${logoCid}" width="120" height="60" alt="${escapeHtml(copy.layout.logoAlt)}" style="display:block;width:120px;height:60px;border:0;font-family:${font};font-size:18px;font-weight:800;color:${palette.brand};"></a>
</td></tr>
<tr><td style="padding:24px 24px 8px;">
${greeting}<h1 style="margin:0;padding:0 0 20px;font-family:${font};font-size:22px;line-height:29px;font-weight:800;color:${palette.brand};">${escapeHtml(content.heading)}</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}${signOff}</table>
</td></tr>
<tr><td style="padding:18px 24px 22px;background:${palette.brandSoft};">
${help}<p style="${p(`font-size:12px;line-height:18px;color:${palette.muted};`)}">${escapeHtml(reasonFor(content.footer))}${manage}</p>
<p style="${p(`font-size:12px;line-height:18px;color:${palette.muted};padding-top:6px;`)}"><a href="${home}" target="_blank" style="color:${palette.muted};text-decoration:none;">${escapeHtml(copy.layout.logoAlt)}</a> · ${escapeHtml(copy.layout.tagline)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** The email as HTML and text, with the logo (and any QR code) attached inline. */
export function renderEmail(content: EmailContent, context: EmailContext): RenderedEmail {
  const images = content.blocks.flatMap((block) => (block.kind === "image" ? [block.image] : []));
  return {
    subject: content.subject,
    text: renderText(content, context),
    html: renderHtml(content, context),
    attachments: [logoImage(), ...images],
  };
}
