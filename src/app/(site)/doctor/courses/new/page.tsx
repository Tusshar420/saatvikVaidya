import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { DoctorCourseForm } from "@/components/site/courses/doctor-course-form";
import { Card } from "@/components/ui/card";
import { courses as copy } from "@/content/courses";
import { doctorCoursesPath } from "@/lib/courses";
import { requireUser } from "@/server/auth/session";
import { userCanTeach } from "@/server/courses/courses";
import { NotADoctor } from "../doctor-gate";

const text = copy.doctor;

export const metadata: Metadata = { title: text.newTitle, robots: { index: false, follow: false } };

/** A doctor creates a course (B2); it waits for staff review. */
export default async function NewDoctorCoursePage() {
  const { user } = await requireUser(`${doctorCoursesPath}/new`);
  if (!(await userCanTeach(user.id))) return <NotADoctor />;
  return (
    <>
      <PageHero eyebrow={text.eyebrow} title={text.newTitle} description={text.description} />
      <div className="shell pt-7 pb-24 md:pt-13.5">
        <Card className="max-w-3xl">
          <DoctorCourseForm id={null} />
        </Card>
      </div>
    </>
  );
}
