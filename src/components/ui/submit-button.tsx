"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

export function SubmitButton({
  children,
  pendingText = "Saving…",
  className,
  variant = "primary",
  size = "md",
  disabled,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  variant?: "primary" | "accent" | "secondary" | "ghost" | "danger" | "success" | "soft";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={cn(className)}
      disabled={pending || disabled}
      name={name}
      value={value}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending ? pendingText : children}
    </Button>
  );
}
