import "server-only";
import { courses as copy } from "@/content/courses";
import { courseHref, doctorCoursesPath } from "@/lib/courses";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { db } from "@/server/db";
import { sendEmail, siteLink } from "./compose";

// Emails about doctors' courses (B1): a course to review (to the content
// team), the team's decision (to the doctor) and each new enrolment (to the
// doctor). The bell notifications are saved by src/server/courses/courses.ts.
// Text lives in src/content/courses.ts.

async function emailOf(userId: string): Promise<{ name: string; email: string } | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  return user && !isPlaceholderEmail(user.email) ? user : null;
}

/** To the content team: a doctor sent a course for review. */
export async function sendCourseSubmitted(
  adminIds: readonly string[],
  course: { id: number; title: string },
  doctor: string,
): Promise<void> {
  const text = copy.notify.submitted.email;
  for (const id of adminIds) {
    const admin = await emailOf(id);
    if (!admin) continue;
    await sendEmail(admin.email, {
      subject: text.subject(course.title, doctor),
      heading: text.heading,
      footer: "staff",
      blocks: [
        { kind: "text", text: text.line(course.title, doctor) },
        { kind: "button", label: text.button, href: siteLink(`/admin/content/courses/${course.id}/edit`) },
      ],
    });
  }
}

/** To the doctor: their course was approved and listed, or sent back with a note. */
export async function sendCourseReviewed(
  authorId: string,
  course: { key: string; title: string },
  decision: "published" | "rejected",
  note: string | null,
): Promise<void> {
  const doctor = await emailOf(authorId);
  if (!doctor) return;
  if (decision === "published") {
    const text = copy.notify.approved.email;
    await sendEmail(doctor.email, {
      subject: text.subject(course.title),
      greetName: doctor.name,
      heading: text.heading,
      footer: "account",
      blocks: [
        { kind: "text", text: text.line(course.title) },
        { kind: "button", label: text.button, href: siteLink(courseHref(course.key)) },
      ],
    });
    return;
  }
  const text = copy.notify.rejected.email;
  await sendEmail(doctor.email, {
    subject: text.subject(course.title),
    greetName: doctor.name,
    heading: text.heading,
    footer: "account",
    blocks: [
      { kind: "text", text: text.line(course.title) },
      ...(note ? [{ kind: "note" as const, title: text.noteTitle, text: note, tone: "warning" as const }] : []),
      { kind: "text", text: text.next },
      { kind: "button", label: text.button, href: siteLink(doctorCoursesPath) },
    ],
  });
}

/** To the doctor: someone paid for and enrolled in their course. */
export async function sendCourseEnrolled(authorId: string, course: { title: string }, student: string): Promise<void> {
  const doctor = await emailOf(authorId);
  if (!doctor) return;
  const text = copy.notify.enrolled.email;
  await sendEmail(doctor.email, {
    subject: text.subject(course.title),
    greetName: doctor.name,
    heading: text.heading,
    footer: "account",
    blocks: [
      { kind: "text", text: text.line(student, course.title) },
      { kind: "button", label: text.button, href: siteLink(doctorCoursesPath) },
    ],
  });
}
