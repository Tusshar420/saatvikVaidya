import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, Phone } from "lucide-react";
import { CourseEnrol } from "@/components/site/courses/course-enrol";
import { Badge, Eyebrow } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { courses as copy } from "@/content/courses";
import { signInPath } from "@/lib/auth-routes";
import { courseHref } from "@/lib/courses";
import { formatPaise } from "@/lib/format";
import { telHref } from "@/lib/phone";
import { effectiveRole, getSession } from "@/server/auth/session";
import { courseInCart } from "@/server/cart/cart";
import { currentCartOwner } from "@/server/cart/request";
import { getSetting } from "@/server/content/settings";
import { readCoursePage } from "@/server/courses/courses";

const text = copy.page;
const keyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function load(key: string) {
  if (key.length > 64 || !keyPattern.test(key)) return null;
  const session = await getSession();
  const viewer = session ? { id: session.user.id, role: effectiveRole(session, "content") } : null;
  return { course: await readCoursePage(key, viewer), signedIn: session !== null };
}

export async function generateMetadata({ params }: PageProps<"/courses/[key]">): Promise<Metadata> {
  const loaded = await load((await params).key);
  return loaded?.course ? { title: loaded.course.title, description: loaded.course.body } : {};
}

/**
 * One course (B1): what it covers, its price and "Enrol". Enrolled buyers,
 * the doctor who made it and staff also see how to join.
 */
export default async function CoursePage({ params }: PageProps<"/courses/[key]">) {
  const loaded = await load((await params).key);
  const course = loaded?.course;
  if (!course) notFound();
  const [inCart, phone] = await Promise.all([
    course.forSale && !course.enrolled ? courseInCart(await currentCartOwner(), course.id) : false,
    getSetting("contact.phone"),
  ]);
  const facts = [
    course.format,
    course.duration ? { label: text.duration, value: course.duration } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  return (
    <div className="shell py-8 sm:py-12">
      <Link href="/courses" className={buttonClasses({ variant: "link", className: "-ml-1 min-h-11 px-1" })}>
        <ChevronLeft aria-hidden className="size-4" />
        {text.back}
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-10">
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <Eyebrow>{course.tag}</Eyebrow>
            <h1 className="mt-2 text-h2 break-words text-ink">{course.title}</h1>
            {course.instructor && <p className="mt-2 text-body text-muted">{text.by(course.instructor)}</p>}
          </div>
          {course.preview && (
            <p className="rounded-md bg-gold-soft px-4 py-3 text-sm font-medium text-gold-ink">{text.previewNote}</p>
          )}
          <p className="text-body text-ink">{course.body}</p>
          <dl aria-label={text.facts} className="grid grid-cols-2 gap-3 sm:max-w-md">
            {facts.map((fact) => (
              <div key={fact.label} className="flex flex-col border-l-2 border-orange pl-2.5">
                <dt className="text-xs text-muted">{fact.label}</dt>
                <dd className="text-sm font-bold text-ink">{fact.value}</dd>
              </div>
            ))}
          </dl>
          {course.details && (
            <section aria-labelledby="course-about" className="border-t border-line pt-5">
              <h2 id="course-about" className="text-h3 text-ink">
                {text.about}
              </h2>
              <div className="mt-2 text-body whitespace-pre-line text-ink">{course.details}</div>
            </section>
          )}
          {course.videoUrl && (
            <a
              href={course.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-2 font-bold text-brand underline-offset-4 hover:underline"
            >
              {text.video}
              <ExternalLink aria-hidden className="size-4" />
            </a>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-40">
          {course.canSeeAccess && (
            <Card as="section" aria-labelledby="course-access">
              {course.enrolled ? (
                <>
                  <Badge variant="success">{text.enrolledTitle}</Badge>
                  <p className="mt-2 text-sm text-muted">{text.enrolledText}</p>
                </>
              ) : (
                <p className="text-small text-muted">{text.authorAccessNote}</p>
              )}
              <h2 id="course-access" className="mt-3 text-h4 text-ink">
                {text.accessTitle}
              </h2>
              <div className="mt-1 text-sm break-words whitespace-pre-line text-ink">
                {course.accessDetails ?? text.accessEmpty}
              </div>
            </Card>
          )}

          {!course.enrolled && (
            <Card as="section" aria-label={text.price}>
              {course.forSale && course.pricePaise !== null ? (
                <>
                  <p className="text-h3 font-extrabold text-ink">{formatPaise(course.pricePaise)}</p>
                  <p className="mt-1 text-small text-muted">{text.priceNote}</p>
                  {course.preview ? null : loaded.signedIn ? (
                    <CourseEnrol courseId={course.id} title={course.title} inCart={inCart} className="mt-4" />
                  ) : (
                    <Link
                      href={signInPath(courseHref(course.key))}
                      className={buttonClasses({ className: "mt-4 w-full" })}
                    >
                      {text.signInToEnrol}
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <p className="font-heading font-extrabold text-ink">{text.notForSaleTitle}</p>
                  <p className="mt-1 text-sm text-muted">{text.notForSaleText}</p>
                  <a href={telHref(phone)} className={buttonClasses({ className: "mt-4 w-full" })}>
                    <Phone aria-hidden className="size-4" />
                    {text.call(phone)}
                  </a>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
