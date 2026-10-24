"use client";

import type { ComponentProps } from "react";

/**
 * A select that submits its form when the choice changes (the toolbar's
 * product form and practice area). The form's own submit button still
 * works without JavaScript.
 */
export function AutoSubmitSelect(
  props: Omit<ComponentProps<"select">, "onChange">,
) {
  return (
    <select
      {...props}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    />
  );
}
