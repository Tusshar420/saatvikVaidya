import "server-only";
import { MAX_BRAND_UNITS } from "@/lib/brand";
import { QUIZ_SECONDS } from "@/lib/quiz";
import { brandProductSelect, brandProductWhere, toBrandProduct } from "@/server/brand/drafts";
import {
  catalogueFiltersSchema,
  listCatalogue,
  type ProductCard,
} from "@/server/catalogue/products";
import { getSetting } from "@/server/content/settings";
import { db } from "@/server/db";
import { getPricingViewer } from "@/server/pricing";
import { findOpenQuiz } from "@/server/quiz/attempts";
import { getHomeQuiz, readLeaderboard, type HomeQuiz } from "@/server/quiz/view";

// Live (not admin-edited) data for the v2 homepage cards: the quiz card, the
// Build Your Brand preview, the Top Brands products and the coins maths.

export type HomeQuizCard = {
  live: HomeQuiz;
  minutes: number;
  reward: number;
  /** The signed-in user's best score on the open quiz and weekly rank. */
  you: { score: number; maxScore: number } | null;
  rank: number | null;
};

export async function getHomeQuizCard(userId: string | null): Promise<HomeQuizCard> {
  const [live, rules] = await Promise.all([getHomeQuiz(), getSetting("coins.rules")]);
  let you: HomeQuizCard["you"] = null;
  let rank: number | null = null;
  if (userId && live.kind === "open") {
    const open = await findOpenQuiz(new Date());
    const [attempt, board] = await Promise.all([
      open
        ? db.quizAttempt.findUnique({
            where: { userId_quizId: { userId, quizId: open.id } },
            select: { score: true, maxScore: true, submittedAt: true },
          })
        : null,
      readLeaderboard("week", userId),
    ]);
    if (attempt?.submittedAt && attempt.maxScore > 0) {
      you = { score: attempt.score, maxScore: attempt.maxScore };
    }
    rank = board.you?.rank ?? null;
  }
  return { live, minutes: QUIZ_SECONDS / 60, reward: rules.quizReward, you, rank };
}

export type LaunchPreview = {
  productId: number;
  name: string;
  formName: string;
  makerName: string | null;
  packSize: string;
  unitLabel: string;
  mrpPaise: number;
  minQty: number;
  /** Up to five quantities (steps of the minimum) with the unit price each reaches. */
  options: { quantity: number; unitPaise: number }[];
};

/** The first eligible Build Your Brand product, with its MOQ steps and tier prices. */
export async function getLaunchPreview(): Promise<LaunchPreview | null> {
  const row = await db.product.findFirst({
    where: brandProductWhere,
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    select: { ...brandProductSelect, mrpPaise: true },
  });
  const product = row ? toBrandProduct(row) : null;
  if (!row || !product) return null;
  const { minQty, unitPricePaise, tiers, unitLabel } = product.terms;

  const quantities = new Set<number>([minQty]);
  for (const tier of tiers) if (tier.minQty % minQty === 0) quantities.add(tier.minQty);
  for (const times of [2, 4, 10, 20, 40]) {
    if (quantities.size >= 5) break;
    if (minQty * times <= MAX_BRAND_UNITS) quantities.add(minQty * times);
  }
  const priceFor = (quantity: number) => {
    let price = unitPricePaise;
    for (const tier of tiers) if (quantity >= tier.minQty) price = tier.unitPricePaise;
    return price;
  };
  return {
    productId: product.id,
    name: product.name,
    formName: product.formName,
    makerName: product.makerName,
    packSize: product.packSize,
    unitLabel,
    mrpPaise: row.mrpPaise,
    minQty,
    options: [...quantities]
      .sort((a, b) => a - b)
      .slice(0, 5)
      .map((quantity) => ({ quantity, unitPaise: priceFor(quantity) })),
  };
}

/** The first three catalogue products at the viewer's prices. */
export async function getTopProducts(): Promise<ProductCard[]> {
  const [viewer, discount] = await Promise.all([
    getPricingViewer(),
    getSetting("pricing.discount"),
  ]);
  const listing = await listCatalogue(catalogueFiltersSchema.parse({}), viewer, discount.percent);
  return listing.products.slice(0, 3);
}

export type CoinMaths = {
  orderRupees: number;
  coins: number;
  valueRupees: number;
  coinsPerRupee: number;
  expiryMonths: number;
};

/** The coins strip's worked example: a ₹10,000 order. */
export async function getCoinMaths(): Promise<CoinMaths> {
  const rules = await getSetting("coins.rules");
  const orderRupees = 10_000;
  const coins = (orderRupees / 1000) * rules.earnPerThousandRupees;
  return {
    orderRupees,
    coins,
    valueRupees: Math.floor(coins / rules.coinsPerRupee),
    coinsPerRupee: rules.coinsPerRupee,
    expiryMonths: rules.expiryMonths,
  };
}
