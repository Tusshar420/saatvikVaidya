import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { courses as copy } from "@/content/courses";
import type { Prisma } from "@/generated/prisma/client";
import { slugify } from "@/lib/catalogue";
import { canTeach, courseForSale, courseHref, courseLimits, doctorCoursesPath } from "@/lib/courses";
import { paiseToRupeeInput } from "@/lib/format";
import { roleCanAccess } from "@/lib/admin-permissions";
import { logAdminAction } from "@/server/admin/audit";
import { youtubeUrlSchema } from "@/server/admin/content";
import { fieldErrorsOf, optionalPrice, optionalText, requiredText } from "@/server/admin/form";
import { db } from "@/server/db";
import { createNotifications } from "@/server/notifications/notifications";
import { sendCourseEnrolled, sendCourseReviewed, sendCourseSubmitted } from "@/server/notify/courses";

// Courses for buyers and doctors (B1, B2). Courses are CourseTeaser rows:
// staff make them in Admin > Courses, approved doctors in their own course
// area (/doctor/courses). A doctor's course waits for staff review
// (status "pending") and is listed only once published.
//
// Enrolment works like owning an ebook: a paid, uncancelled order line for
// the course. Buyers keep access if the course is hidden later. The joining
// details (accessDetails) are shown only to them, the author and staff.

const MAX_PAISE = courseLimits.maxRupees * 100;

/** An order line that enrols its buyer: paid and not cancelled. */
const enrolledLineWhere = (userId: string): Prisma.OrderItemWhereInput => ({
  kind: "course",
  order: { userId, paidAt: { not: null }, status: { not: "cancelled" } },
});

/** Which of these courses the user is enrolled in. */
export async function enrolledCourseIds(
  userId: string,
  courseIds?: readonly number[],
  client: Prisma.TransactionClient = db,
): Promise<Set<number>> {
  const rows = await client.orderItem.findMany({
    where: {
      ...enrolledLineWhere(userId),
      courseId: courseIds ? { in: [...courseIds] } : { not: null },
    },
    distinct: ["courseId"],
    select: { courseId: true },
  });
  return new Set(rows.flatMap((row) => (row.courseId === null ? [] : [row.courseId])));
}

/** Paid enrolments per course (for the doctor's list and staff review). */
export async function enrolmentCounts(courseIds: readonly number[]): Promise<Map<number, number>> {
  if (courseIds.length === 0) return new Map();
  const rows = await db.orderItem.groupBy({
    by: ["courseId"],
    where: {
      kind: "course",
      courseId: { in: [...courseIds] },
      order: { paidAt: { not: null }, status: { not: "cancelled" } },
    },
    _count: { _all: true },
  });
  return new Map(rows.flatMap((row) => (row.courseId === null ? [] : [[row.courseId, row._count._all]])));
}

// ─── The course page ────────────────────────────────────────────────────────

/** Who is looking: null when signed out. */
export type CourseViewer = { id: string; role: string } | null;

export type CoursePage = {
  id: number;
  key: string;
  tag: string;
  title: string;
  body: string;
  details: string | null;
  format: { label: string; value: string };
  instructor: string | null;
  duration: string | null;
  videoUrl: string | null;
  pricePaise: number | null;
  forSale: boolean;
  /** Not listed yet (or hidden): only the author and staff see it. */
  preview: boolean;
  enrolled: boolean;
  /** The viewer's order for this course that still waits for payment (QR or bank transfer). */
  awaitingPaymentOrderId: string | null;
  isAuthor: boolean;
  /** Only for enrolled buyers, the author and staff. */
  accessDetails: string | null;
  canSeeAccess: boolean;
};

/**
 * The course page for `key`, or null when this viewer may not see it.
 * Listed courses are public; the author and staff also see unlisted ones,
 * and enrolled buyers keep seeing theirs.
 */
export async function readCoursePage(key: string, viewer: CourseViewer): Promise<CoursePage | null> {
  const course = await db.courseTeaser.findUnique({ where: { key } });
  if (!course) return null;
  const listed = course.active && course.status === "published";
  const isAdmin = viewer?.role === "admin";
  const isAuthor = viewer !== null && course.authorId === viewer.id;
  const enrolled = viewer ? (await enrolledCourseIds(viewer.id, [course.id])).has(course.id) : false;
  if (!listed && !isAdmin && !isAuthor && !enrolled) return null;
  const canSeeAccess = enrolled || isAuthor || isAdmin;
  const awaiting =
    viewer && !enrolled
      ? await db.order.findFirst({
          where: { userId: viewer.id, status: "pending_payment", items: { some: { kind: "course", courseId: course.id } } },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })
      : null;
  return {
    id: course.id,
    key: course.key,
    tag: course.tag,
    title: course.title,
    body: course.body,
    details: course.details,
    format: { label: course.metaLabel, value: course.metaValue },
    instructor: course.instructor,
    duration: course.duration,
    videoUrl: course.videoUrl,
    pricePaise: course.pricePaise,
    forSale: courseForSale(course),
    preview: !listed,
    enrolled,
    awaitingPaymentOrderId: awaiting?.id ?? null,
    isAuthor,
    accessDetails: canSeeAccess ? course.accessDetails : null,
    canSeeAccess,
  };
}

export type MyCourse = {
  key: string;
  title: string;
  instructor: string | null;
  enrolledAt: Date;
};

/** The user's enrolments, newest first ("My courses" on /account). */
export async function listMyEnrolments(userId: string): Promise<MyCourse[]> {
  const rows = await db.orderItem.findMany({
    where: enrolledLineWhere(userId),
    orderBy: { order: { paidAt: "desc" } },
    select: {
      courseId: true,
      productName: true,
      order: { select: { paidAt: true } },
      course: { select: { key: true, title: true, instructor: true } },
    },
  });
  const seen = new Set<number>();
  const result: MyCourse[] = [];
  for (const row of rows) {
    // A course deleted later has no page to open.
    if (row.courseId === null || !row.course || seen.has(row.courseId)) continue;
    seen.add(row.courseId);
    result.push({
      key: row.course.key,
      title: row.course.title,
      instructor: row.course.instructor,
      enrolledAt: row.order.paidAt!,
    });
  }
  return result;
}

// ─── The doctor's course area ───────────────────────────────────────────────

/** True when the user may create and sell courses (read fresh, never cached). */
export async function userCanTeach(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { verificationStatus: true, userType: { select: { key: true } } },
  });
  return Boolean(
    user && canTeach({ userTypeKey: user.userType.key, verificationStatus: user.verificationStatus }),
  );
}

const errors = copy.doctor.errors;

/** What a doctor types into the course form. */
export const doctorCourseSchema = z
  .object({
    title: requiredText(courseLimits.title, errors.title),
    tag: requiredText(courseLimits.tag, errors.tag),
    body: requiredText(courseLimits.body, errors.body),
    details: optionalText(courseLimits.details, errors.details),
    format: requiredText(courseLimits.format, errors.format),
    duration: optionalText(courseLimits.duration, errors.duration),
    price: optionalPrice(errors.price, MAX_PAISE),
    videoUrl: youtubeUrlSchema,
    accessDetails: optionalText(courseLimits.accessDetails, errors.accessDetails),
  })
  .transform(({ price, format, ...rest }) => ({ ...rest, metaValue: format, pricePaise: price }));

export type DoctorCourseRow = {
  id: number;
  key: string;
  title: string;
  status: "pending" | "published" | "rejected";
  active: boolean;
  pricePaise: number | null;
  reviewNote: string | null;
  enrolments: number;
};

/** The doctor's own courses, newest first. */
export async function listDoctorCourses(authorId: string): Promise<DoctorCourseRow[]> {
  const rows = await db.courseTeaser.findMany({
    where: { authorId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      key: true,
      title: true,
      status: true,
      active: true,
      pricePaise: true,
      reviewNote: true,
    },
  });
  const counts = await enrolmentCounts(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, enrolments: counts.get(row.id) ?? 0 }));
}

/** One of the doctor's courses as form values, or null if it isn't theirs. */
export async function doctorCourseValues(
  authorId: string,
  id: number,
): Promise<Record<string, string> | null> {
  const course = await db.courseTeaser.findFirst({ where: { id, authorId } });
  if (!course) return null;
  return {
    title: course.title,
    tag: course.tag,
    body: course.body,
    details: course.details ?? "",
    format: course.metaValue,
    duration: course.duration ?? "",
    price: course.pricePaise === null ? "" : paiseToRupeeInput(course.pricePaise),
    videoUrl: course.videoUrl ?? "",
    accessDetails: course.accessDetails ?? "",
  };
}

export type SaveResult =
  | { ok: true; id: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** A unique, readable key for a new course: its title and a short random part. */
function newCourseKey(title: string): string {
  const base = slugify(title).slice(0, 50).replace(/-+$/, "") || "course";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

/** Staff who can review content (super and content admins). */
async function contentAdmins() {
  const admins = await db.user.findMany({
    where: { role: "admin" },
    select: { id: true, adminRole: true },
  });
  return admins.filter((admin) => roleCanAccess(admin.adminRole, "content"));
}

/**
 * Creates (id null) or updates one of the doctor's courses. Every save goes
 * back to staff review, so a listed course is unlisted until approved again;
 * enrolled buyers keep their access meanwhile.
 */
export async function saveDoctorCourse(
  author: { id: string; name: string },
  id: number | null,
  input: Record<string, unknown>,
): Promise<SaveResult> {
  if (!(await userCanTeach(author.id))) return { ok: false, error: errors.forbidden };
  const parsed = doctorCourseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: errors.generic, fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const data = parsed.data;
  const fields = {
    title: data.title,
    tag: data.tag,
    body: data.body,
    details: data.details,
    metaLabel: copy.doctor.fields.format,
    metaValue: data.metaValue,
    duration: data.duration,
    pricePaise: data.pricePaise,
    videoUrl: data.videoUrl,
    accessDetails: data.accessDetails,
    instructor: author.name.slice(0, 80),
    status: "pending" as const,
    reviewNote: null,
    submittedAt: new Date(),
  };

  let savedId: number;
  if (id === null) {
    const created = await db.courseTeaser.create({
      data: {
        ...fields,
        key: newCourseKey(data.title),
        authorId: author.id,
        linkLabel: copy.card.view,
        active: true,
        // After the staff's own courses.
        sortOrder: 500,
      },
      select: { id: true },
    });
    savedId = created.id;
  } else {
    const updated = await db.courseTeaser.updateMany({ where: { id, authorId: author.id }, data: fields });
    if (updated.count === 0) return { ok: false, error: errors.notFound };
    savedId = id;
  }

  const admins = await contentAdmins();
  await createNotifications(
    admins.map((admin) => ({
      userId: admin.id,
      kind: "admin" as const,
      title: copy.notify.submitted.title(data.title),
      body: copy.notify.submitted.body(author.name),
      href: `/admin/content/courses/${savedId}/edit`,
    })),
  );
  await sendCourseSubmitted(
    admins.map((admin) => admin.id),
    { id: savedId, title: data.title },
    author.name,
  ).catch((error: unknown) => console.error("saveDoctorCourse: review email not sent.", error));
  return { ok: true, id: savedId };
}

/** Deletes one of the doctor's courses, unless anyone has enrolled. */
export async function deleteDoctorCourse(
  authorId: string,
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const course = await db.courseTeaser.findFirst({ where: { id, authorId }, select: { id: true } });
  if (!course) return { ok: false, error: errors.notFound };
  if (((await enrolmentCounts([id])).get(id) ?? 0) > 0) {
    return { ok: false, error: errors.hasEnrolments };
  }
  await db.courseTeaser.delete({ where: { id } });
  return { ok: true };
}

/** True when anyone has paid for the course (it then can't be deleted). */
export async function hasEnrolments(id: number): Promise<boolean> {
  return ((await enrolmentCounts([id])).get(id) ?? 0) > 0;
}

// ─── Staff review ───────────────────────────────────────────────────────────

const reviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), note: z.string().trim().max(courseLimits.reviewNote).optional() }),
  z.object({
    decision: z.literal("reject"),
    note: z.string().trim().min(1, copy.review.noteNeeded).max(courseLimits.reviewNote, copy.review.noteNeeded),
  }),
]);

/** Approves (lists) or sends back a course, and tells its author. */
export async function reviewCourse(
  actorId: string,
  id: number,
  input: { decision: string; note?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? copy.review.noteNeeded };
  const { decision } = parsed.data;
  const note = parsed.data.note || null;
  const course = await db.courseTeaser.findUnique({
    where: { id },
    select: { id: true, key: true, title: true, status: true, authorId: true },
  });
  if (!course) return { ok: false, error: errors.notFound };
  const status = decision === "approve" ? ("published" as const) : ("rejected" as const);
  await db.$transaction(async (tx) => {
    await tx.courseTeaser.update({ where: { id }, data: { status, reviewNote: note } });
    await logAdminAction(tx, {
      actorId,
      action: "course.review",
      resource: "CourseTeaser",
      resourceId: id,
      changes: { status: { from: course.status, to: status } },
      note,
    });
  });
  if (course.authorId) {
    await createNotifications([
      {
        userId: course.authorId,
        kind: "course",
        title:
          status === "published"
            ? copy.notify.approved.title(course.title)
            : copy.notify.rejected.title(course.title),
        body: status === "published" ? copy.notify.approved.body : copy.notify.rejected.body(note ?? ""),
        href: status === "published" ? courseHref(course.key) : doctorCoursesPath,
      },
    ]);
    await sendCourseReviewed(course.authorId, course, status, note).catch((error: unknown) =>
      console.error("reviewCourse: email not sent.", error),
    );
  }
  return { ok: true };
}

/** After a paid order: tell each course's author about the new enrolment, and the buyer how to join. */
export async function notifyCourseEnrolments(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      userId: true,
      user: { select: { name: true } },
      items: {
        where: { kind: "course", courseId: { not: null } },
        select: { course: { select: { key: true, title: true, authorId: true } } },
      },
    },
  });
  if (!order || !order.userId) return;
  const buyerId = order.userId;
  const courses = order.items.flatMap((item) => (item.course ? [item.course] : []));
  await createNotifications(
    courses.flatMap((course) => [
      {
        userId: buyerId,
        kind: "course" as const,
        title: copy.notify.buyer.title(course.title),
        body: copy.notify.buyer.body,
        href: courseHref(course.key),
      },
      ...(course.authorId && course.authorId !== buyerId
        ? [
            {
              userId: course.authorId,
              kind: "course" as const,
              title: copy.notify.enrolled.title(course.title),
              body: copy.notify.enrolled.body(order.user?.name ?? ""),
              href: doctorCoursesPath,
            },
          ]
        : []),
    ]),
  );
  for (const course of courses) {
    if (!course.authorId || course.authorId === buyerId) continue;
    await sendCourseEnrolled(course.authorId, course, order.user?.name ?? "").catch((error: unknown) =>
      console.error("notifyCourseEnrolments: email not sent.", error),
    );
  }
}
