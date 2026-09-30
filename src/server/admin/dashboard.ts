import "server-only";
import { db } from "@/server/db";
import { readActivity, type ActivityItem } from "./audit";

export type DashboardSummary = {
  users: number;
  professionals: number;
  pending: number;
  admins: number;
  content: {
    reels: { total: number; active: number };
    brands: { total: number; active: number };
    courses: { total: number; active: number };
    quizzes: { total: number; active: number };
  };
  activity: ActivityItem[];
};

/** Counts for the dashboard cards plus the latest admin changes. */
export async function readDashboard(): Promise<DashboardSummary> {
  const [
    users,
    professionals,
    pending,
    admins,
    reels,
    reelsActive,
    brands,
    brandsActive,
    courses,
    coursesActive,
    quizzes,
    quizzesActive,
    activity,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { userType: { isProfessional: true } } }),
    db.user.count({
      where: {
        verificationStatus: "pending",
        userType: { requiresVerification: true },
      },
    }),
    db.user.count({ where: { role: "admin" } }),
    db.reel.count(),
    db.reel.count({ where: { active: true } }),
    db.brand.count(),
    db.brand.count({ where: { active: true } }),
    db.courseTeaser.count(),
    db.courseTeaser.count({ where: { active: true } }),
    db.quiz.count(),
    db.quiz.count({ where: { active: true } }),
    readActivity({ take: 8 }),
  ]);
  return {
    users,
    professionals,
    pending,
    admins,
    content: {
      reels: { total: reels, active: reelsActive },
      brands: { total: brands, active: brandsActive },
      courses: { total: courses, active: coursesActive },
      quizzes: { total: quizzes, active: quizzesActive },
    },
    activity,
  };
}
