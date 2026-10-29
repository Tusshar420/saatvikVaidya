"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/** A submit button that shows a spinner and blocks clicks while its form is sending. */
export function SubmitButton({ loading, ...props }: Omit<ButtonProps, "type">) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={loading || pending} {...props} />;
}
