"use client";

import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import type { FeedbackItem } from "@/server/content/home";

type FeedbackSectionProps = {
  heading: { eyebrow: string | null; title: string | null; titleEmphasis: string | null; description: string | null };
  feedback: FeedbackItem[];
};

export function FeedbackSection({ heading, feedback }: FeedbackSectionProps) {
  const featured = feedback.filter((f) => f.featured);
  const others = feedback.filter((f) => !f.featured);

  return (
    <section className="section-y" id="feedback">
      <div className="shell">
        <SectionHeading
          eyebrow={heading.eyebrow}
          title={heading.title}
          emphasis={heading.titleEmphasis}
          description={heading.description}
        />

        <div className="mt-16 space-y-8">
          {/* Featured feedback */}
          {featured.length > 0 && (
            <Card interactive>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="overflow-hidden rounded-l-xl h-full min-h-80">
                  <Image
                    src={featured[0].imageSrc}
                    alt={featured[0].imageAlt}
                    width={400}
                    height={400}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 sm:p-8 flex flex-col justify-center">
                  <div className="text-label text-teal uppercase">
                    {featured[0].badge}
                  </div>
                  <blockquote className="text-h3 mt-4">
                    {featured[0].quote}
                  </blockquote>
                  <div className="mt-6">
                    <p className="text-body font-600">{featured[0].caption}</p>
                    {featured[0].link.href ? (
                      <Link
                        href={featured[0].link.href}
                        className="inline-block text-teal font-600 mt-3 hover:underline"
                        target="_blank"
                        rel="noopener"
                      >
                        {featured[0].link.label} →
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Other feedback cards */}
          {others.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((item) => (
                <Card key={item.key} interactive>
                  <div className="overflow-hidden rounded-t-xl h-48">
                    <Image
                      src={item.imageSrc}
                      alt={item.imageAlt}
                      width={300}
                      height={200}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="text-label text-teal uppercase">
                      {item.badge}
                    </div>
                    <p className="text-body font-500 mt-3 line-clamp-3">
                      {item.quote}
                    </p>
                    <p className="text-small text-muted mt-3">{item.caption}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
