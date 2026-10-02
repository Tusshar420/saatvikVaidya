import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ActiveBadge } from "@/components/admin/badges";
import {
  DataTable,
  EmptyRow,
  TBody,
  THead,
  Td,
  Th,
  Tr,
} from "@/components/admin/data-table";
import { Notice, parseNotice } from "@/components/admin/notice";
import { AdminPageHeader } from "@/components/admin/page-header";
import { RowActions } from "@/components/admin/row-actions";
import { buttonClasses } from "@/components/ui/button";
import { admin as copy } from "@/content/admin";
import { listCourses } from "@/server/admin/content";
import { requireAdmin } from "@/server/auth/session";
import { deleteCourseAction } from "../actions";

export const metadata: Metadata = { title: copy.courses.metaTitle };

const text = copy.courses;

export default async function CoursesPage({
  searchParams,
}: PageProps<"/admin/content/courses">) {
  await requireAdmin("content");
  const [courses, params] = await Promise.all([listCourses(), searchParams]);

  return (
    <>
      <AdminPageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
        action={
          <Link href="/admin/content/courses/new" className={buttonClasses()}>
            <Plus aria-hidden className="size-4.5" />
            {text.add}
          </Link>
        }
      />
      <Notice notice={parseNotice(params.notice)} />
      <DataTable caption={text.title} className="mt-6">
        <THead>
          <Th>{text.columns.title}</Th>
          <Th>{text.columns.instructor}</Th>
          <Th>{text.columns.duration}</Th>
          <Th>{text.columns.status}</Th>
          <Th>{text.columns.sortOrder}</Th>
          <Th>
            <span className="sr-only">{text.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {courses.length === 0 && (
            <EmptyRow colSpan={6}>{text.empty}</EmptyRow>
          )}
          {courses.map((course) => (
            <Tr key={course.id}>
              <Td>
                <span className="block font-bold break-words text-ink">
                  {course.title}
                </span>
                <code className="block text-small text-muted">{course.key}</code>
              </Td>
              <Td label={text.columns.instructor}>
                {course.instructor ?? text.notSet}
              </Td>
              <Td label={text.columns.duration}>
                {course.duration ?? text.notSet}
              </Td>
              <Td label={text.columns.status}>
                <ActiveBadge active={course.active} />
              </Td>
              <Td label={text.columns.sortOrder}>{course.sortOrder}</Td>
              <Td>
                <RowActions
                  editHref={`/admin/content/courses/${course.id}/edit`}
                  deleteAction={deleteCourseAction}
                  id={course.id}
                  name={course.title}
                />
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>
    </>
  );
}
