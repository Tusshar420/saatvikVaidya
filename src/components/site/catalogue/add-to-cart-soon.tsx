import { Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { catalogue as copy } from "@/content/catalogue";
import { telHref } from "@/lib/phone";

const text = copy.product;

/**
 * "Add to cart" until the cart exists (P1.4): the button is disabled and
 * says why, with a way to order by phone today. One per page (fixed id).
 */
const noteId = "add-to-cart-note";

export function AddToCartSoon({ phone }: { phone: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 max-sm:*:w-full">
        <Button disabled aria-describedby={noteId}>
          {text.addToCart}
        </Button>
        <a href={telHref(phone)} className={buttonClasses({ variant: "secondary" })}>
          <Phone aria-hidden className="size-4" />
          {text.call(phone)}
        </a>
      </div>
      <p id={noteId} className="flex flex-wrap items-center gap-2 text-small text-muted">
        <Badge variant="soon">{text.cartSoon}</Badge>
        {text.cartSoonLine(phone)}
      </p>
    </div>
  );
}
