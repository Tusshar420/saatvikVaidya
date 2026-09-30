"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import type { LearningItem } from "@/server/content/home";

type CoursesSectionProps = {
  heading: { eyebrow: string | null; title: string | null; titleEmphasis: string | null; description: string | null };
  courses: LearningItem[];
  liveSessions: LearningItem[];
};

function LearningCard({ item }: { item: LearningItem }) {
  return (
    <Card interactive>
      <div className="p-6">
        <div className="text-label text-teal uppercase">{item.tag}</div>
        <h3 className="text-h3 mt-3">{item.title}</h3>
        <p className="text-body text-muted mt-3">{item.body}</p>
        <div className="flex justify-between items-center mt-4 text-small text-muted">
          <span>{item.meta.label}</span>
          <span className="font-600">{item.meta.value}</span>
        </div>
        {item.link.href ? (
          <Link
            href={item.link.href}
            className="inline-block text-teal font-600 mt-4 hover:underline"
          >
            {item.link.label} →
          </Link>
        ) : (
          <span className="inline-block text-muted font-600 mt-4">
            {item.link.label} (coming soon)
          </span>
        )}
      </div>
    </Card>
  );
}

export function CoursesSection({
  heading,
  courses,
  liveSessions,
}: CoursesSectionProps) {
  return (
    <section className="section-y" id="courses">
      <div className="shell">
        <SectionHeading
          eyebrow={heading.eyebrow}
          title={heading.title}
          titleEmphasis={heading.titleEmphasis}
          description={heading.description}
        />

        <div className="mt-16 space-y-16">
          {/* Courses */}
          {courses.length > 0 && (
            <div>
              <h3 className="text-h2 mb-8">Courses</h3>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <LearningCard key={course.key} item={course} />
                ))}
              </div>
            </div>
          )}

          {/* Live Sessions */}
          {liveSessions.length > 0 && (
            <div>
              <h3 className="text-h2 mb-8">Saatvik Live</h3>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {liveSessions.map((session) => (
                  <LearningCard key={session.key} item={session} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
