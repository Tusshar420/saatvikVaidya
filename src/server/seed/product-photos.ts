// The client's label photos ("Client Data/product images", November 2026).
// `pnpm photos:prepare <folder>` makes web copies in prisma/product-photos/
// (committed); "Load label photos" on /admin/catalogue/photos puts them on the
// products (src/server/admin/label-photos.ts).
//
// One set per medicine. The first photo (the file numbered 1) is the default:
// it becomes the shop photo and the first Build Your Brand variant. The
// others (2, 3... or "1 copy", "1 copy 2") are the other variants, named
// after the label's colour. Where every label of a medicine has the same
// colours (churnas: blue; guggulu and vati: dark green), the name adds the
// layout: "panel" (a tall centre panel), "wave" (a curved band) or "band"
// (a straight band).
//
// A set applies to every pack size with that name in the catalogue
// (src/server/seed/catalogue-list.ts). Files left out on purpose:
// - "Arishta_AMRITARISHTA 3" and "Arishta_MAHARASNADI KWATH 4": the same
//   picture as file 1 of that medicine.
// - Kanchanar Kwath, Mahavat Vidhwans Ras, Praval Panchamrit Ras
//   ("GUGGULU-61", "GUGGULU_Artboard 1 copy", "... 1 copy 2"): not in the
//   catalogue.
// - Punarnavarishta: the catalogue has Punarnavasava, a different medicine.

import { variantKeyPattern, type BrandThemeKey } from "@/lib/brand-theme";

export type PhotoSet = {
  /** Catalogue product names (every pack size with the name gets the photos). */
  products: readonly string[];
  /** Files in variant order; the first is the default. */
  photos: readonly { file: string; name: string }[];
};

/** "Arishta_X 1.jpg" style sets: [file prefix, ...variant names] for 1, 2, 3... */
function numbered(prefix: string, products: string[], names: string[], skip: number[] = []): PhotoSet {
  return {
    products,
    photos: names
      .map((name, index) => ({ file: `${prefix} ${index + 1}.jpg`, name }))
      .filter((_, index) => !skip.includes(index + 1)),
  };
}

/** "X 1.jpg", "X 1 copy.jpg", "X 1 copy 2.jpg" sets. */
function copies(prefix: string, products: string[], names: string[]): PhotoSet {
  const suffixes = ["1", "1 copy", "1 copy 2"];
  return {
    products,
    photos: names.map((name, index) => ({ file: `${prefix} ${suffixes[index]}.jpg`, name })),
  };
}

const churna = ["Blue panel", "Blue wave", "Blue band"];
const green = ["Green band", "Green panel", "Green wave"];

export const photoSets: readonly PhotoSet[] = [
  // Asava–Arishta and Kwath: one colour per label.
  numbered("Arishta_ABHAYARISHTA", ["Abhyarishta"], ["Purple", "Blue", "Green", "Brown"]),
  // File 3 is the same picture as file 1.
  numbered("Arishta_AMRITARISHTA", ["Amritarishta"], ["Purple", "Brown", "", "Green"], [3]),
  numbered("Arishta_ARJUNARISHTA", ["Arjunarishta"], ["Blue", "Purple", "Green", "Brown"]),
  numbered("Arishta_ASHOKARISHTA", ["Ashokarishta"], ["Brown", "Purple", "Royal Blue", "Green"]),
  numbered("Arishta_ASHWAGANDHARISHTA", ["Ashwagandharishta"], ["Royal Blue", "Brown", "Purple", "Green"]),
  numbered("Arishta_BALARISHTA", ["Balarishta"], ["Green", "Royal Blue", "Brown", "Purple"]),
  numbered("Arishta_DASHMOOLARISHTA", ["Dashmularishta"], ["Red", "Dark Green", "Royal Blue", "Brown"]),
  numbered("Arishta_KALMEGHASAV", ["Kalmeghasava"], ["Wine", "Brown", "Blue", "Green"]),
  numbered("Arishta_KANKASAV", ["Kanakasava"], ["Wine", "Navy Blue", "Royal Blue"]),
  numbered("Arishta_KHADIRARISHTA", ["Khadirarishta"], ["Red", "Brown", "Green", "Wine"]),
  numbered("Arishta_KUMARIASAV", ["Kumariasava"], ["Wine", "Maroon", "Dark Green", "Royal Blue"]),
  numbered("Arishta_MAHAMANJISTHADI KWATH", ["Mahamanjisthadi Kwath"], ["Maroon", "Royal Blue", "Purple", "Red"]),
  // File 4 is the same picture as file 1.
  numbered("Arishta_MAHARASNADI KWATH", ["Maharasnadi Kwath"], ["Green", "Violet", "Blue", ""], [4]),
  numbered("Arishta_PUNARNAVADI", ["Punarnava Kwath"], ["Navy Blue", "Royal Blue", "Wine"]),

  // Churna and pak: all blue, three layouts.
  numbered("CHURNA_AVIPATTIKAR CHURNA", ["Avipatikar Churna"], churna),
  copies("CHURNA_HARIDRA KHAND", ["Haridra Khanda"], churna.slice(0, 2)),
  numbered("CHURNA_HINGWASTAK CHURNA", ["Hingwastak Churna"], churna),
  copies("CHURNA_MUSLI PAK", ["Musli Pak"], churna.slice(0, 2)),
  numbered("CHURNA_PANCHSAKAR CHURNA", ["Panchasakar Churna"], churna),
  numbered("CHURNA_SITOPALADI CHURNA", ["Sitopaladi Churna"], churna),
  copies("CHURNA_SUPARI PAK", ["Supari Pak"], churna.slice(0, 2)),
  copies("CHURNA_TRIPHALA CHURNA", ["Triphala Churna"], ["Blue panel", "Blue wave", "White"]),

  // Avaleha. The "Chyawan Pran Avleh" labels read "Sugar Free".
  numbered("CHYWANPRASH_CHYAWAN PRAN AVLEH", ["Chyawanprash - Sugar Free"], [
    "Purple",
    "Maroon",
    "Orange",
    "Green & cream",
    "Green",
  ]),
  numbered("CHYWANPRASH_CHYAWANPRASH", ["Chyawanprash - Regular"], [
    "Gold",
    "Blue",
    "Yellow",
    "Green",
    "Black",
  ]),
  {
    products: ["Pranjeevan Avleh - Kesar Yukt"],
    photos: [{ file: "CHYWANPRASH_PRAN JEEVAN AVLEH - KESAR .jpg", name: "Maroon" }],
  },

  // Guggulu, vati and ras: all dark green, three layouts.
  numbered("GUGGULU_AGNITUNDI VATI", ["Agnitundi Vati"], green),
  numbered("GUGGULU_AROGYAVARDHANI VATI", ["Arogyavardhini Vati / Ras"], green),
  numbered("GUGGULU_ARSH KUTHAR RAS", ["Arshkuthar Ras"], green),
  copies("GUGGULU_CHANDRAPRABHA VATI", ["Chandraprabha Vati"], green),
  copies("GUGGULU_EKANGVEER RAS", ["Ekangveer Ras"], green),
  numbered("GUGGULU_ERAND TAIL HARITAKI", ["Erand Tail Haritaki Tablet"], green),
  numbered("GUGGULU_GANDHAK RASAYAN", ["Gandhak Rasayan"], green),
  numbered("GUGGULU_KAISHORE GUGGULU", ["Kaisor Guggulu"], green),
  numbered("GUGGULU_KANCHANAR GUGGULU", ["Kanchanar Guggulu"], green),
  copies("GUGGULU_KANKAYAN VATI", ["Kankayan Vati (Arsh)"], green),
  copies("GUGGULU_MAHAYOGRAJ GUGGULU", ["Mahayograj Guggulu"], green),
  numbered("GUGGULU_PRABHAKAR VATI", ["Prabhakar Vati"], green),
  numbered("GUGGULU_PUNARNAVADI MAN", ["Punarnavadi Mandoor"], green),
  numbered("GUGGULU_SANJEEVANI VATI", ["Sanjeevni Vati"], green),
  {
    products: ["Sarpgandha Vati"],
    photos: green.map((name, index) => ({ file: `GUGGULU_SARPGANDHA GHAN${index + 1}.jpg`, name })),
  },
  numbered("GUGGULU_SHILAJITWADI VATI", ["Shilajatwadi Vati"], green),
  copies("GUGGULU_TRYODASHANG GUGGULU", ["Trayodashang Guggulu"], green),
  copies("GUGGULU_VRADHIVADHIKA VATI", ["Vradhivatika Vati"], green),
  copies("GUGGULU_YOGRAJ GUGGULU", ["Yograj Guggulu"], green),
  // Basant (Vasant) Kusumakar Ras: unnamed files.
  {
    products: ["Vasant Kusmakar Ras S.Y."],
    photos: [
      { file: "GUGGULU-62.jpg", name: "Green band" },
      { file: "GUGGULU_Artboard 2 copy.jpg", name: "Green panel" },
      { file: "GUGGULU_Artboard 2 copy 2.jpg", name: "Green wave" },
    ],
  },
];

/** Where the web copies live, relative to the project folder. */
export const LABEL_PHOTOS_DIR = "prisma/product-photos";

/** A client file's web copy name: "Arishta_X 1.jpg" → "arishta-x-1.jpg". */
export function preparedFileName(file: string): string {
  const base = file
    .replace(/\.jpe?g$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}.jpg`;
}

/** A variant's stored key from its name: "Royal Blue" → "royal-blue". */
export function photoVariantKey(name: string): string {
  const key = name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  if (!variantKeyPattern.test(key)) throw new Error(`No key for variant name ${JSON.stringify(name)}`);
  return key;
}

/**
 * The drawn pack's colours for a variant (used only if its photo is gone):
 * the nearest of the four label themes.
 */
export function photoVariantStyle(name: string): BrandThemeKey {
  const text = name.toLowerCase();
  if (/green/.test(text)) return "classic-green";
  if (/orange|yellow|gold|saffron/.test(text)) return "saffron-glow";
  if (/purple|violet|wine|maroon|red|brown/.test(text)) return "royal-maroon";
  return "minimal-white";
}

/** The photo's description (alt text), editable later in /admin/catalogue. */
export function photoAlt(productName: string, variantName: string): string {
  return `${productName} label, ${variantName}`;
}
