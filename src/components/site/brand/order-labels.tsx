import { Badge } from "@/components/ui/badge";
import { brand as copy } from "@/content/brand";
import { formatPaise } from "@/lib/format";
import { specFields, type LabelSnapshot } from "@/lib/label";

const text = copy.labels;

/**
 * The label of each product of a brand order, as it was ordered (the copy
 * saved with the order line): the pack's printable area and logo place, then
 * every field printed on it. Proofs are made from exactly this text.
 */
export function OrderLabels({
  items,
  empty,
}: {
  items: { productName: string; label: LabelSnapshot | null }[];
  /** Shown for a line from before label details were saved. */
  empty: string;
}) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((item, index) => {
        const label = item.label;
        return (
          <li key={`${item.productName}-${index}`} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="min-w-0 text-base font-extrabold break-words text-ink">{item.productName}</h3>
              {label && label.overridden.length > 0 && <Badge variant="gold">{text.review.edited}</Badge>}
            </div>
            {label ? (
              <>
                <p className="mt-1 text-small text-muted">
                  {text.area(label.spec.name, label.spec.widthMm, label.spec.heightMm)} ·{" "}
                  {text.logo(
                    label.spec.logo.widthMm,
                    label.spec.logo.heightMm,
                    text.placements[label.spec.logo.placement],
                  )}
                </p>
                {(label.theme || label.packMrpPaise) && (
                  <p className="mt-1 text-small font-bold text-ink">
                    {[
                      label.theme && `${text.theme}: ${copy.customise.themes[label.theme] ?? label.theme}`,
                      label.packMrpPaise && `${text.packMrp}: ${formatPaise(label.packMrpPaise)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {specFields(label.spec).map((field) =>
                    label.values[field] ? (
                      <div key={field} className="min-w-0">
                        <dt className="text-small font-bold text-muted">
                          {text.fields[field]}
                          {label.overridden.includes(field) && (
                            <span className="ml-1.5 font-medium text-gold-ink">({text.changed.toLowerCase()})</span>
                          )}
                        </dt>
                        <dd className="break-words whitespace-pre-line text-ink">{label.values[field]}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              </>
            ) : (
              <p className="mt-1 text-small text-muted">{empty}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
