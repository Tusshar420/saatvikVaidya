// SAMPLE catalogue data. No real catalogue has been supplied yet, so these 12
// classical formulations show how the catalogue works. Every product has
// `isSample: true`, which the site shows as a "Sample" label; names are
// classical formulations, but prices, stock and brand assignments are
// invented examples. Replace them through /admin/catalogue once the real
// catalogue arrives (the seed only creates products whose slug is missing, so
// admin edits are kept).
//
// Money is in paise. GST 5% and HSN 30049011 (Ayurvedic medicaments) are
// placeholders for the admin to confirm per product.

export type ProductSeed = {
  slug: string;
  name: string;
  brandKey: string;
  formKey: string;
  practiceAreaKeys: string[];
  description: string;
  ingredients: string;
  dosage: string;
  packSize: string;
  mrpPaise: number;
  professionalPricePaise: number;
  bulkTiers: { minQuantity: number; pricePaise: number }[];
  stock: number;
  moq?: number;
  featured?: boolean;
  sortOrder: number;
};

export const SAMPLE_GST_RATE = 5;
export const SAMPLE_HSN_CODE = "30049011";

const tabletDose =
  "1–2 tablets twice a day after meals with lukewarm water, or as directed by the physician.";
const churnaDose =
  "3–5 g at bedtime with lukewarm water, or as directed by the physician.";
const arishtaDose =
  "15–30 ml with an equal amount of water, twice a day after meals, or as directed by the physician.";
const avalehaDose =
  "1–2 teaspoons (10–15 g) once or twice a day, or as directed by the physician.";

export const productSeed: ProductSeed[] = [
  {
    slug: "punarnava-mandoor",
    name: "Punarnava Mandoor",
    brandKey: "sabka-vaidya",
    formKey: "vati-gutika",
    practiceAreaKeys: ["kidney-care"],
    description:
      "A classical Mandoora Kalpana formulation described in Ayurvedic texts, traditionally used by physicians to support healthy fluid balance and kidney function.",
    ingredients:
      "Punarnava (Boerhavia diffusa), Mandoor Bhasma, Trikatu, Triphala, Chitrak, Vidanga",
    dosage: tabletDose,
    packSize: "60 tablets",
    mrpPaise: 32_000,
    professionalPricePaise: 24_000,
    bulkTiers: [
      { minQuantity: 10, pricePaise: 22_500 },
      { minQuantity: 50, pricePaise: 21_000 },
    ],
    stock: 240,
    featured: true,
    sortOrder: 10,
  },
  {
    slug: "chandraprabha-vati",
    name: "Chandraprabha Vati",
    brandKey: "sabka-vaidya",
    formKey: "vati-gutika",
    practiceAreaKeys: ["kidney-care"],
    description:
      "A widely prescribed classical vati, traditionally used to support the urinary system and overall vitality.",
    ingredients: "Shilajit, Guggulu, Karpoor, Vacha, Musta, Haridra, Triphala",
    dosage: tabletDose,
    packSize: "60 tablets",
    mrpPaise: 28_000,
    professionalPricePaise: 21_000,
    bulkTiers: [
      { minQuantity: 10, pricePaise: 19_800 },
      { minQuantity: 50, pricePaise: 18_500 },
    ],
    stock: 180,
    sortOrder: 20,
  },
  {
    slug: "arogyavardhini-vati",
    name: "Arogyavardhini Vati",
    brandKey: "pranacharya",
    formKey: "vati-gutika",
    practiceAreaKeys: ["liver-care", "digestive-care"],
    description:
      "A classical Rasaushadhi formulation traditionally used to support liver function and healthy digestion.",
    ingredients:
      "Kutki (Picrorhiza kurroa), Triphala, Shilajit, Guggulu, Chitrak, Tamra Bhasma, Loha Bhasma",
    dosage: tabletDose,
    packSize: "60 tablets",
    mrpPaise: 26_000,
    professionalPricePaise: 19_500,
    bulkTiers: [{ minQuantity: 25, pricePaise: 18_000 }],
    stock: 8,
    sortOrder: 30,
  },
  {
    slug: "triphala-churna",
    name: "Triphala Churna",
    brandKey: "sabka-vaidya",
    formKey: "churna",
    practiceAreaKeys: ["digestive-care"],
    description:
      "The classical blend of three fruits, traditionally used as a gentle daily support for digestion and regular bowel movements.",
    ingredients:
      "Amalaki (Emblica officinalis), Bibhitaki (Terminalia bellirica) and Haritaki (Terminalia chebula) in equal parts",
    dosage: churnaDose,
    packSize: "100 g",
    mrpPaise: 15_000,
    professionalPricePaise: 11_000,
    bulkTiers: [
      { minQuantity: 10, pricePaise: 10_200 },
      { minQuantity: 50, pricePaise: 9_500 },
    ],
    stock: 400,
    featured: true,
    sortOrder: 40,
  },
  {
    slug: "avipattikar-churna",
    name: "Avipattikar Churna",
    brandKey: "pranacharya",
    formKey: "churna",
    practiceAreaKeys: ["digestive-care"],
    description:
      "A classical churna traditionally used to support comfortable digestion and a balanced Pitta.",
    ingredients: "Trikatu, Triphala, Musta, Vidanga, Ela, Tejpatra, Lavang, Trivrit, Sharkara",
    dosage: churnaDose,
    packSize: "100 g",
    mrpPaise: 16_500,
    professionalPricePaise: 12_500,
    bulkTiers: [],
    stock: 150,
    sortOrder: 50,
  },
  {
    slug: "yogaraj-guggulu",
    name: "Yogaraj Guggulu",
    brandKey: "pranacharya",
    formKey: "guggulu",
    practiceAreaKeys: ["joint-care"],
    description:
      "A classical Guggulu preparation traditionally used to support joint comfort and mobility.",
    ingredients: "Guggulu, Chitrak, Pippalimool, Ajwain, Vidanga, Devdaru, Triphala, Rasna",
    dosage: tabletDose,
    packSize: "60 tablets",
    mrpPaise: 29_500,
    professionalPricePaise: 22_000,
    bulkTiers: [{ minQuantity: 10, pricePaise: 20_500 }],
    stock: 120,
    sortOrder: 60,
  },
  {
    slug: "kaishore-guggulu",
    name: "Kaishore Guggulu",
    brandKey: "flowgra",
    formKey: "guggulu",
    practiceAreaKeys: ["skin-care", "joint-care"],
    description:
      "A classical Guggulu preparation traditionally used to support clear skin and healthy joints.",
    ingredients: "Guggulu, Triphala, Guduchi (Tinospora cordifolia), Trikatu, Vidanga, Trivrit, Danti",
    dosage: tabletDose,
    packSize: "60 tablets",
    mrpPaise: 27_500,
    professionalPricePaise: 20_500,
    bulkTiers: [],
    stock: 0,
    sortOrder: 70,
  },
  {
    slug: "dashmoolarishta",
    name: "Dashmoolarishta",
    brandKey: "sabka-vaidya",
    formKey: "asava-arishta",
    practiceAreaKeys: ["womens-health"],
    description:
      "A classical fermented preparation of the ten roots, traditionally used as a restorative tonic, especially after childbirth.",
    ingredients: "Dashmool (ten roots), Chitrak, Pushkarmool, Lodhra, Guduchi, Amalaki, Draksha, Dhataki",
    dosage: arishtaDose,
    packSize: "450 ml",
    mrpPaise: 21_500,
    professionalPricePaise: 16_000,
    bulkTiers: [
      { minQuantity: 12, pricePaise: 15_000 },
      { minQuantity: 48, pricePaise: 14_000 },
    ],
    stock: 90,
    sortOrder: 80,
  },
  {
    slug: "ashokarishta",
    name: "Ashokarishta",
    brandKey: "flowgra",
    formKey: "asava-arishta",
    practiceAreaKeys: ["womens-health"],
    description:
      "A classical arishta based on Ashoka bark, traditionally used to support women's health and a regular cycle.",
    ingredients: "Ashoka bark (Saraca asoca), Dhataki, Jaggery, Musta, Shunthi, Daruharidra, Amalaki",
    dosage: arishtaDose,
    packSize: "450 ml",
    mrpPaise: 19_500,
    professionalPricePaise: 14_500,
    bulkTiers: [],
    stock: 60,
    sortOrder: 90,
  },
  {
    slug: "chyawanprash",
    name: "Chyawanprash",
    brandKey: "sabka-vaidya",
    formKey: "avaleha",
    practiceAreaKeys: ["respiratory-care"],
    description:
      "The classical Amalaki-based rasayana, traditionally taken daily to support immunity, strength and respiratory health.",
    ingredients: "Amalaki (Emblica officinalis), Dashmool, Pippali, Ghee, Sesame oil, Honey, Ashwagandha, Shatavari",
    dosage: avalehaDose,
    packSize: "500 g",
    mrpPaise: 34_500,
    professionalPricePaise: 26_000,
    bulkTiers: [{ minQuantity: 10, pricePaise: 24_500 }],
    stock: 75,
    featured: true,
    sortOrder: 100,
  },
  {
    slug: "vasavaleha",
    name: "Vasavaleha",
    brandKey: "pranacharya",
    formKey: "avaleha",
    practiceAreaKeys: ["respiratory-care"],
    description:
      "A classical Vasa-based avaleha, traditionally used to support clear breathing and a comfortable throat.",
    ingredients: "Vasa (Adhatoda vasica), Pippali, Sharkara, Ghee, Honey",
    dosage: avalehaDose,
    packSize: "250 g",
    mrpPaise: 24_000,
    professionalPricePaise: 18_000,
    bulkTiers: [],
    stock: 40,
    sortOrder: 110,
  },
  {
    slug: "mahanarayan-taila",
    name: "Mahanarayan Taila",
    brandKey: "flowgra",
    formKey: "taila-ghrita",
    practiceAreaKeys: ["joint-care"],
    description:
      "A classical medicated oil for external massage, traditionally used to ease stiff joints and tired muscles.",
    ingredients: "Sesame oil, Bilva, Ashwagandha, Brihati, Shatavari, Bala, Dashmool, Rasna",
    dosage: "For external use only. Massage gently over the area, or as directed by the physician.",
    packSize: "100 ml",
    mrpPaise: 22_000,
    professionalPricePaise: 16_500,
    bulkTiers: [
      { minQuantity: 10, pricePaise: 15_500 },
      { minQuantity: 50, pricePaise: 14_500 },
    ],
    stock: 110,
    moq: 2,
    sortOrder: 120,
  },
];
