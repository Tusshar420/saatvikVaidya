// `pnpm db:seed:demo`: DUMMY data for looking around the site locally. Run it
// after `pnpm db:seed`. It adds extra courses, live sessions and feedback, a
// quiz for the current week, and a generated placeholder picture for every
// product that has none. Safe to repeat: rows are only created when missing.
// Not part of the normal seed (e2e tests expect that one), and not for the
// live site; everything here is made up.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL;
if (!url)
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
const db = new PrismaClient({ adapter: new PrismaMariaDb(url) });
const storageDir = process.env.STORAGE_DIR ?? "storage";

const courses = [
  {
    key: "demo-panchakarma-basics",
    sortOrder: 20,
    tag: "FOUNDATION COURSE",
    title: "Panchakarma Practice Essentials",
    body: "Patient selection, purvakarma and a step-by-step view of the five therapies.",
    metaLabel: "Format",
    metaValue: "Self-paced video course",
    instructor: "Vd. Saatvik",
    duration: "6 hours",
    linkLabel: "View course",
  },
  {
    key: "demo-rasa-shastra",
    sortOrder: 30,
    tag: "ADVANCED COURSE",
    title: "Rasa Shastra for the Clinic",
    body: "Working with bhasma and rasa formulations: quality checks, dosage and safety.",
    metaLabel: "Format",
    metaValue: "2-Day Online CME",
    instructor: "Vd. Saatvik",
    duration: "2 days",
    linkLabel: "View course",
  },
  {
    key: "demo-women-health",
    sortOrder: 40,
    tag: "SPECIAL COURSE",
    title: "Stree Roga: Women's Health in Ayurveda",
    body: "Menstrual, fertility and menopause care with classical formulations.",
    metaLabel: "Format",
    metaValue: "4-Week Online Programme",
    instructor: "Vd. Saatvik",
    duration: "4 weeks",
    linkLabel: "View course",
  },
];

const liveSessions = [
  {
    key: "demo-kidney-case-discussion",
    sortOrder: 20,
    tag: "UPCOMING LIVE",
    title: "Kidney Care Case Discussion",
    body: "Real clinical cases, protocols and your questions answered live.",
    metaLabel: "Next session",
    metaValue: "Thursday • 7 PM",
    linkLabel: "Reserve seat",
  },
  {
    key: "demo-herb-identification",
    sortOrder: 30,
    tag: "UPCOMING LIVE",
    title: "Herb Identification Workshop",
    body: "Spot genuine raw drugs and learn simple quality checks before you buy.",
    metaLabel: "Next session",
    metaValue: "Saturday • 11 AM",
    linkLabel: "Reserve seat",
  },
];

const feedback = [
  {
    key: "demo-clinic-note-english",
    sortOrder: 20,
    featured: false,
    imageSrc: "/media/doctor-feedback-english.jpg",
    imageAlt: "Handwritten feedback from a practising physician",
    badge: "VERIFIED NOTE",
    quote:
      "“Consistent quality and prompt delivery. My patients notice the difference.”",
    caption: "Original handwritten feedback • Shared with consent",
    linkLabel: "Read the original feedback",
    linkHref: "/media/doctor-feedback-english.jpg",
  },
];

type Question = [prompt: string, options: [string, string, string, string], correct: number, explanation: string];

const quizQuestions: Question[] = [
  ["Which dosha is mainly linked with movement?", ["Vata", "Pitta", "Kapha", "None"], 0, "Vata governs movement and the nervous system."],
  ["Triphala is made from how many fruits?", ["Two", "Three", "Four", "Five"], 1, "Amalaki, Bibhitaki and Haritaki."],
  ["Which taste increases Kapha the most?", ["Pungent", "Bitter", "Sweet", "Astringent"], 2, "Madhura (sweet) taste increases Kapha."],
  ["Punarnava is traditionally used for support of the…", ["Eyes", "Kidneys", "Hair", "Teeth"], 1, "Punarnava is a classical herb for fluid balance and kidney health."],
  ["Which of these is a Panchakarma therapy?", ["Vamana", "Dhyana", "Pranayama", "Surya Namaskar"], 0, "Vamana is therapeutic emesis, one of the five."],
  ["Chyawanprash is best known as a…", ["Digestive churna", "Rasayana tonic", "Massage oil", "Eye wash"], 1, "It is an Avaleha taken as a rejuvenating Rasayana."],
  ["Agni in Ayurveda refers to…", ["Digestive fire", "Water", "Air", "Sleep"], 0, "Agni is the digestive and metabolic fire."],
  ["Ashokarishta is commonly associated with…", ["Women's health", "Joint oil", "Skin paste", "Hair wash"], 0, "It is a classical Arishta used in women's health."],
  ["How many Mahabhutas (great elements) are there?", ["Three", "Four", "Five", "Seven"], 2, "Earth, water, fire, air and space."],
  ["Mahanarayan Taila is mainly used…", ["Internally as syrup", "As a massage oil", "As eye drops", "As a gargle"], 1, "It is a medicated oil for abhyanga."],
];

/** Start of this week (Monday, 00:00 IST) as an instant. */
function weekStart(now: Date): Date {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const sinceMonday = (ist.getUTCDay() + 6) % 7;
  ist.setUTCHours(0, 0, 0, 0);
  ist.setUTCDate(ist.getUTCDate() - sinceMonday);
  return new Date(ist.getTime() - 330 * 60_000);
}

async function seedQuiz(): Promise<string> {
  const title = "Weekly Ayurveda Quiz (demo)";
  if (await db.quiz.findFirst({ where: { title }, select: { id: true } })) {
    return "demo quiz already present";
  }
  const startsAt = weekStart(new Date());
  await db.quiz.create({
    data: {
      title,
      description: "Ten quick questions on Ayurveda basics. Dummy quiz for testing.",
      active: true,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 7 * 24 * 3600_000),
      passPercent: 60,
      questions: {
        create: quizQuestions.map(([prompt, options, correct, explanation], i) => ({
          sortOrder: i,
          prompt,
          points: 10,
          explanation,
          options: {
            create: options.map((text, o) => ({
              sortOrder: o,
              text,
              isCorrect: o === correct,
            })),
          },
        })),
      },
    },
  });
  return "created demo quiz for this week";
}

const palettes = [
  ["#2f5d3a", "#a8c686"],
  ["#7a4b1e", "#e0b97a"],
  ["#3b4a6b", "#9fb3d9"],
  ["#6b2f3a", "#d9a0aa"],
];

async function seedProductImages(): Promise<number> {
  // sharp ships with Next.js; borrow it rather than adding a dependency.
  const nextRequire = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
  const sharp = nextRequire("sharp") as (input: Buffer) => {
    jpeg: (options: { quality: number }) => { toBuffer: () => Promise<Buffer> };
  };
  const products = await db.product.findMany({
    where: { images: { none: {} } },
    select: { id: true, name: true, packSize: true },
  });
  let made = 0;
  for (const product of products) {
    const [dark, light] = palettes[product.id % palettes.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
<rect width="800" height="800" fill="${light}"/>
<rect x="260" y="180" width="280" height="460" rx="36" fill="${dark}"/>
<rect x="320" y="120" width="160" height="80" rx="16" fill="#f4efe4"/>
<rect x="290" y="300" width="220" height="200" rx="12" fill="#f4efe4"/>
<text x="400" y="385" font-family="Georgia,serif" font-size="26" text-anchor="middle" fill="${dark}">${escapeXml(product.name.slice(0, 18))}</text>
<text x="400" y="430" font-family="Georgia,serif" font-size="20" text-anchor="middle" fill="${dark}">${escapeXml(product.packSize ?? "Sample")}</text>
<text x="400" y="740" font-family="Georgia,serif" font-size="22" text-anchor="middle" fill="${dark}">Demo image</text>
</svg>`;
    const bytes = await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
    const fileKey = `products/${product.id}/demo${product.id}.jpg`;
    const path = join(storageDir, fileKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    await db.productImage.create({
      data: {
        productId: product.id,
        fileKey,
        contentType: "image/jpeg",
        sizeBytes: bytes.length,
        alt: `${product.name} (demo image)`,
      },
    });
    made += 1;
  }
  return made;
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

async function main(): Promise<void> {
  for (const row of courses) {
    await db.courseTeaser.upsert({ where: { key: row.key }, create: row, update: {} });
  }
  for (const row of liveSessions) {
    await db.liveSession.upsert({ where: { key: row.key }, create: row, update: {} });
  }
  for (const row of feedback) {
    await db.feedback.upsert({ where: { key: row.key }, create: row, update: {} });
  }
  console.info(
    `Demo data: ${courses.length} courses, ${liveSessions.length} live sessions, ${feedback.length} feedback; ${await seedQuiz()}; ${await seedProductImages()} product images created.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
