import type { ReactNode } from "react";
import { brand as copy } from "@/content/brand";
import { cn } from "@/lib/cn";
import { LaunchHero } from "./launch-hero";
import { LaunchSteps } from "./launch-steps";

/** The v2 page: hero, then the steps bar and the step on the cream body. */
export function LaunchFrame({ step, children }: { step: number; children: ReactNode }) {
  const hero = copy.launch.hero;
  return (
    <>
      <LaunchHero
        kicker={hero.kicker}
        title={hero.title}
        line={hero.line}
        note={{
          status: hero.noteStatus,
          title: hero.noteTitle,
          line: hero.noteLine,
        }}
      />
      <div className="bg-cream pt-7 pb-19 sm:pt-9.5 md:pt-13.5 md:pb-24">
        <div className="shell">
          <LaunchSteps
            label={copy.launch.stepsLabel}
            steps={copy.launch.steps.map((label, index) => ({
              label,
              detail: copy.launch.stepDetails[index],
            }))}
            current={step - 1}
          />
          <section aria-labelledby="launch-step-title" className="mt-6.25">
            <p className="sr-only">
              {copy.launch.stepOf(step, copy.launch.steps.length)}
            </p>
            {children}
          </section>
        </div>
      </div>
    </>
  );
}

export function StepHeading({
  title,
  line,
  hidden = false,
}: {
  title: string;
  line: string;
  /** Kept for screen readers only (the steps bar already says it). */
  hidden?: boolean;
}) {
  return (
    <div className={cn(hidden && "sr-only")}>
      <h2 id="launch-step-title" className="text-h3 text-ink">
        {title}
      </h2>
      <p className="mt-1.5 max-w-2xl text-body text-muted">{line}</p>
    </div>
  );
}
