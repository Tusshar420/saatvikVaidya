import { buttonClasses } from "@/components/ui/button";
import { home as copy } from "@/content/home";
import { cn } from "@/lib/cn";
import { HomeEyebrow } from "./home-parts";
import { SiteModalButton } from "./site-modals";

const text = copy.track;
/** The illustrated stepper shows the stages an order moves through, up to Quality. */
const ACTIVE_STEP = 3;

/** v2 Track Order banner (`.track-section`): dark green card with the order stages and the track button. */
export function TrackSection() {
  return (
    <section id="track" aria-labelledby="track-title" className="bg-surface pb-15.5 sm:pb-25">
      <div className="shell reveal grid items-center gap-7 rounded-[20px] bg-forest px-5 py-6.75 text-white shadow-forest sm:rounded-[26px] sm:p-10 md:grid-cols-[1fr_1.3fr] md:gap-10 lg:grid-cols-[.8fr_1.3fr_auto]">
        <div>
          <HomeEyebrow light>{text.eyebrow}</HomeEyebrow>
          <h2 id="track-title" className="m-0 mb-2.25 text-[25px] leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-[28px]">
            {text.title}
          </h2>
          <p className="m-0 text-small text-forest-ink">{text.body}</p>
        </div>
        <div className="rounded-[15px] border border-white/13 bg-white/8 px-3 py-3.5 sm:p-4.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex flex-col">
              <b className="text-xs">{text.sample}</b>
              <small className="mt-0.5 text-[11px] text-forest-ink">{text.sampleSub}</small>
            </span>
            <span className="shrink-0 rounded-[7px] bg-gold px-2 py-1.5 text-[11px] font-extrabold whitespace-nowrap text-gold-ink">
              {text.status}
            </span>
          </div>
          <ol aria-label={text.stepsLabel} className="mt-4.25 grid grid-cols-5 p-0">
            {text.steps.map((step, index) => (
              <li key={step} className="flex flex-col">
                <span
                  aria-hidden
                  className={cn(
                    "relative mb-2 h-0.75",
                    index <= ACTIVE_STEP ? "bg-gold" : "bg-white/18",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1/2 left-0 size-2.75 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
                      index <= ACTIVE_STEP ? "border-gold bg-gold" : "border-forest-ink bg-brand-mid",
                      index === ACTIVE_STEP && "ring-5 ring-gold/20",
                    )}
                  />
                </span>
                <span className="-translate-x-1 text-[11px] text-forest-ink max-sm:text-[9px] sm:-translate-x-2">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <SiteModalButton
          modal="trackOrder"
          className={buttonClasses({ className: "justify-self-start md:col-span-2 md:justify-self-center lg:col-span-1 max-sm:w-full" })}
        >
          {text.cta}
        </SiteModalButton>
      </div>
    </section>
  );
}
