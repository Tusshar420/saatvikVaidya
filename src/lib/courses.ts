// Course rules shared by the server, the forms and the pages (B1: buying a
// course; B2: doctors' own courses). Text lives in src/content/courses.ts.

/** SAC for commercial training and coaching services. */
export const COURSE_SAC_CODE = "999293";

export const courseHref = (key: string) => `/courses/${key}`;

/** The doctor's course area. */
export const doctorCoursesPath = "/doctor/courses";

export const courseLimits = {
  title: 160,
  tag: 60,
  body: 300,
  details: 5000,
  accessDetails: 2000,
  format: 80,
  duration: 40,
  reviewNote: 500,
  /** Highest price in rupees (including GST). */
  maxRupees: 500_000,
} as const;

export const courseStatuses = ["pending", "published", "rejected"] as const;
export type CourseStatusKey = (typeof courseStatuses)[number];

/** Approved Ayurveda doctors make and sell their own courses. */
export function canTeach(user: { userTypeKey: string; verificationStatus: string }): boolean {
  return user.userTypeKey === "doctor" && user.verificationStatus === "approved";
}

type SaleFields = { active: boolean; status: string; pricePaise: number | null };

/** A course that can be bought now: shown, published and priced. */
export function courseForSale(course: SaleFields): boolean {
  return (
    course.active &&
    course.status === "published" &&
    course.pricePaise !== null &&
    course.pricePaise > 0
  );
}

/** Listed on the site: shown and published (priced or not). */
export const listedCourseWhere = { active: true, status: "published" } as const;
