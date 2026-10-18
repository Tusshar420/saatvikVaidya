// Strings for the catalogue: /products, /products/[slug] and /search. Keep
// user-facing text here so Hindi can be added later.

import type { CatalogueSort } from "@/lib/catalogue";

const count = (n: number) => n.toLocaleString("en-IN");

export const catalogue = {
  listing: {
    metaTitle: "Products",
    metaDescription:
      "Classical Ayurveda formulations from Saatvik Vaidya's selected brands, with clear retail and professional prices.",
    eyebrow: "Product catalogue",
    title: "Classical formulations.",
    titleEmphasis: "Clear, fair prices.",
    description:
      "Browse by form, practice area or brand. Approved Ayurveda professionals see their professional price on every product.",
    results: (n: number) =>
      n === 1 ? "1 product" : `${count(n)} products`,
    resultsFor: (n: number, q: string) =>
      `${n === 1 ? "1 product" : `${count(n)} products`} for “${q}”`,
    empty: {
      title: "No products match these filters",
      line: "Try removing a filter, or browse the whole catalogue.",
      action: "Show all products",
    },
  },

  filters: {
    label: "Filter and sort products",
    toggle: "Filters & sort",
    toggleCount: (n: number) => `Filters & sort (${n})`,
    form: "Form",
    area: "Practice area",
    brand: "Brand",
    any: "All",
    sort: "Sort by",
    apply: "Apply",
    clear: "Clear all",
    active: "Active filters",
    remove: (label: string) => `Remove filter: ${label}`,
    search: (q: string) => `“${q}”`,
    sorts: {
      featured: "Featured",
      "price-asc": "Price: low to high",
      "price-desc": "Price: high to low",
      name: "Name: A to Z",
      newest: "Newest",
    } satisfies Record<CatalogueSort, string>,
    formsLabel: "Browse by form",
    allForms: "All forms",
  },

  card: {
    sample: "Sample",
    outOfStock: "Out of stock",
    minOrder: (n: number) => `Min. order ${count(n)}`,
    mrp: "MRP",
    yourPrice: "Your price",
    percentOff: (n: number) => `${n}% off`,
  },

  pagination: {
    label: (page: number, total: number) => `Page ${page} of ${total}`,
    previous: "Previous",
    next: "Next",
  },

  /** The homepage catalogue card's button. */
  viewAllProducts: "View all products",

  sampleNote:
    "These are sample products while the full catalogue is prepared. Names, prices and stock are examples only.",

  product: {
    breadcrumb: "Breadcrumb",
    products: "Products",
    sampleBadge: "Sample product",
    sampleNote:
      "This is a sample product to show how the catalogue works. Its prices and stock are examples.",
    gallery: {
      label: "Product images",
      show: (n: number, total: number) => `Show image ${n} of ${total}`,
      noImage: "Image coming soon",
    },
    by: "by",
    packSize: "Pack size",
    price: {
      label: "Price",
      mrp: "MRP",
      mrpInclusive: "MRP, inclusive of all taxes",
      professional: "Your professional price",
      bulkLabel: "Your price from 1 unit",
      inclusive: (rate: number) => `Inclusive of ${rate}% GST`,
      save: (amount: string) => `You save ${amount} on MRP`,
      bulkTitle: "Bulk prices for you",
      bulkQuantity: (n: number) => `${count(n)}+ units`,
      bulkPerUnit: "per unit",
      bulkCaption: "Bulk prices per unit by quantity",
      quantityColumn: "Quantity",
      priceColumn: "Price per unit",
    },
    hint: {
      guest: "Ayurveda professional? Sign in and get verified to see professional prices.",
      guestAction: "Sign in",
      customer:
        "Professional prices are for verified Ayurveda doctors, clinics, pharmacies and stockists.",
      unverified:
        "Your professional price shows here once your documents are approved.",
      unverifiedAction: "Check verification",
    },
    stock: {
      inStock: "In stock",
      low: (n: number) => `Only ${count(n)} left`,
      out: "Out of stock",
    },
    moq: (n: number) => `Minimum order: ${count(n)} units`,
    sections: {
      description: "About this product",
      ingredients: "Key ingredients",
      dosage: "Dosage",
      details: "Product details",
    },
    details: {
      brand: "Brand",
      form: "Form",
      practiceAreas: "Practice areas",
      packSize: "Pack size",
      gst: "GST",
      gstValue: (rate: number) => `${rate}%`,
      hsn: "HSN code",
      moq: "Minimum order",
    },
    dosageNote: "Take Ayurveda medicines under the guidance of a qualified physician.",
    notFoundTitle: "Product not found",
  },

  search: {
    metaTitle: "Search",
    metaTitleFor: (q: string) => `Search: ${q}`,
    eyebrow: "Search",
    title: "Find a product",
    label: "Search products",
    placeholder: "Search by name, brand, form or ingredient",
    submit: "Search",
    popular: "Popular searches",
    browseAll: "Browse all products",
    refine: "Filter these results",
    empty: {
      title: (q: string) => `Nothing found for “${q}”`,
      line: "Check the spelling, try a shorter word, or browse the catalogue.",
    },
    prompt: "Type a product, brand, form or ingredient to search the catalogue.",
  },
} as const;
