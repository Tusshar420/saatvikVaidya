"use client";

import { Button, ButtonGroup } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { designPage } from "@/content/design";

const copy = designPage.toast;

export function ToastDemo() {
  const toast = useToast();
  return (
    <ButtonGroup>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast({ title: copy.successTitle, description: copy.successBody })
        }
      >
        {copy.success}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast({
            title: copy.errorTitle,
            description: copy.errorBody,
            tone: "error",
          })
        }
      >
        {copy.error}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => toast({ title: copy.infoTitle, tone: "info" })}
      >
        {copy.info}
      </Button>
    </ButtonGroup>
  );
}
