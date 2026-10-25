import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { courses as copy } from "@/content/courses";

/** Shown instead of the course area to anyone who isn't an approved doctor. */
export function NotADoctor() {
  const text = copy.doctor.notDoctor;
  return (
    <div className="shell py-10 sm:py-16">
      <EmptyState
        as="h1"
        icon={<ShieldCheck aria-hidden />}
        title={text.title}
        description={text.text}
        className="mx-auto max-w-2xl py-14"
        action={
          <Link href="/account#account-status" className={buttonClasses()}>
            {text.account}
          </Link>
        }
      />
    </div>
  );
}
