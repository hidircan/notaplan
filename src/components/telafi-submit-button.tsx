"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import type { ReactNode } from "react";

/** Submit button that disables and shows a pending label while its own <form> is submitting. */
export function TelafiSubmitButton({
  children,
  pendingLabel,
  variant,
  className,
  disabled,
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} className={className} disabled={pending || disabled}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
