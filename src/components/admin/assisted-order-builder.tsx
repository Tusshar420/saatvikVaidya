"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { createAssistedOrderAction } from "@/app/admin/assisted-orders/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { assistedOrders as copy } from "@/content/assisted-orders";
import { cn } from "@/lib/cn";
import { MAX_QUANTITY_INPUT } from "@/lib/orders";
import { idleForm } from "@/server/admin/form";
import type { ProductOption } from "@/server/assisted-orders/assisted-orders";

const text = copy.admin.create;
const SHOWN = 8;

type Chosen = { productId: number; quantity: number };

const label = (product: ProductOption) =>
  [product.name, product.packSize, product.brandName].filter(Boolean).join(" · ");

/**
 * Steps 2 and 3 of "Prepare an order": find medicines and add them with a
 * quantity, then a message for the customer. Only product ids and
 * quantities are sent; the server checks them and prices the order later.
 */
export function AssistedOrderBuilder({
  customerId,
  products,
}: {
  customerId: string;
  products: ProductOption[];
}) {
  const [state, action, pending] = useActionState(createAssistedOrderAction, idleForm);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Chosen[]>([]);
  const byId = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches =
    words.length === 0
      ? []
      : products.filter(
          (product) =>
            !chosen.some((line) => line.productId === product.id) &&
            words.every((word) => label(product).toLowerCase().includes(word)),
        );

  const add = (product: ProductOption) => {
    setChosen((lines) => [...lines, { productId: product.id, quantity: product.moq }]);
    setQuery("");
  };
  const setQuantity = (productId: number, quantity: number) =>
    setChosen((lines) => lines.map((line) => (line.productId === productId ? { ...line, quantity } : line)));
  const remove = (productId: number) => setChosen((lines) => lines.filter((line) => line.productId !== productId));

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="userId" value={customerId} />
      <input type="hidden" name="items" value={JSON.stringify(chosen)} />

      <section
        aria-labelledby="assisted-products"
        className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
      >
        <h2 id="assisted-products" className="text-h3 text-ink">
          {text.productsStep}
        </h2>
        <p className="mt-1 text-sm text-muted">{text.productsHelp}</p>

        <label htmlFor="assisted-product-search" className="mt-4 mb-1.5 block text-xs font-extrabold text-ink">
          {text.productSearchLabel}
        </label>
        <span className="relative block">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted"
          />
          <input
            id="assisted-product-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Enter adds the only match instead of submitting the form.
              if (event.key === "Enter") {
                event.preventDefault();
                if (matches.length === 1) add(matches[0]!);
              }
            }}
            placeholder={text.productSearchPlaceholder}
            maxLength={100}
            autoComplete="off"
            className={cn(inputClasses, "pl-10")}
          />
        </span>

        {words.length > 0 && (
          <div className="mt-3">
            {matches.length === 0 ? (
              <p className="text-sm text-muted">{text.noProducts}</p>
            ) : (
              <>
                <ul aria-label={text.productResultsLabel} className="flex flex-col divide-y divide-line rounded-lg border border-line">
                  {matches.slice(0, SHOWN).map((product) => (
                    <li key={product.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="min-w-0 text-sm">
                        <span className="block font-bold break-words text-ink">{product.name}</span>
                        <span className="block text-small text-muted">
                          {[product.packSize, product.brandName].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={<Plus aria-hidden className="size-4" />}
                        aria-label={text.addProductLabel(product.name)}
                        onClick={() => add(product)}
                      >
                        {text.addProduct}
                      </Button>
                    </li>
                  ))}
                </ul>
                {matches.length > SHOWN && (
                  <p className="mt-2 text-small text-muted">{text.moreProducts(matches.length - SHOWN)}</p>
                )}
              </>
            )}
          </div>
        )}

        <h3 className="mt-6 text-label text-muted uppercase">{text.chosenTitle}</h3>
        {chosen.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{text.noneChosen}</p>
        ) : (
          <ul aria-label={text.chosenTitle} className="mt-2 flex flex-col gap-2">
            {chosen.map((line) => {
              const product = byId.get(line.productId);
              if (!product) return null;
              const inputId = `assisted-qty-${product.id}`;
              return (
                <li
                  key={line.productId}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-alt px-3 py-2"
                >
                  <span className="min-w-0 flex-1 basis-48 text-sm">
                    <span className="block font-bold break-words text-ink">{product.name}</span>
                    <span className="block text-small text-muted">
                      {[product.packSize, product.moq > 1 ? text.minimum(product.moq) : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <label htmlFor={inputId} className="sr-only">
                    {text.quantityLabel(product.name)}
                  </label>
                  <input
                    id={inputId}
                    type="number"
                    inputMode="numeric"
                    min={product.moq}
                    max={MAX_QUANTITY_INPUT}
                    step={1}
                    value={line.quantity}
                    onChange={(event) => setQuantity(product.id, Math.max(0, Math.floor(Number(event.target.value) || 0)))}
                    className={cn(inputClasses, "w-24")}
                  />
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    icon={<Trash2 aria-hidden className="size-4" />}
                    aria-label={text.removeLabel(product.name)}
                    onClick={() => remove(product.id)}
                  >
                    {text.remove}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="assisted-note"
        className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
      >
        <h2 id="assisted-note" className="text-h3 text-ink">
          {text.noteStep}
        </h2>
        <label htmlFor="assisted-note-input" className="mt-4 mb-1.5 block text-xs font-extrabold text-ink">
          {text.noteLabel}
        </label>
        <textarea
          id="assisted-note-input"
          name="note"
          rows={3}
          maxLength={500}
          defaultValue={state.status === "error" ? (state.values?.note ?? "") : ""}
          aria-describedby="assisted-note-help"
          className={cn(inputClasses, "h-auto py-3 leading-normal")}
        />
        <p id="assisted-note-help" className="mt-1.5 text-small text-muted">
          {text.noteHelp}
        </p>
      </section>

      {state.status === "error" && state.message && <FormAlert>{state.message}</FormAlert>}
      <div className="flex flex-col gap-2">
        <Button type="submit" loading={pending} disabled={chosen.length === 0} arrow className="self-start max-sm:w-full">
          {text.submit}
        </Button>
        <p className="text-small text-muted">{text.submitNote}</p>
      </div>
    </form>
  );
}
