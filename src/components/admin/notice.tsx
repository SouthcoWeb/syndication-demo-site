import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AlertIcon, CheckCircleIcon, InfoIcon } from "../ui/icons";

const TONES = {
  info: { box: "border-primary/25 bg-primary-soft/60", icon: "text-primary", Icon: InfoIcon },
  success: { box: "border-success/30 bg-success/10", icon: "text-success", Icon: CheckCircleIcon },
  warning: { box: "border-warning/40 bg-warning/10", icon: "text-warning", Icon: AlertIcon },
  danger: { box: "border-danger/30 bg-danger/10", icon: "text-danger", Icon: AlertIcon },
} as const;

/** Inline message box. Text stays in the foreground color for contrast; the tone shows in the icon and tint. */
export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { box, icon, Icon } = TONES[tone];
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={cn("flex gap-3 rounded-2xl border p-4 text-sm", box, className)}>
      <Icon size={18} className={cn("mt-0.5 shrink-0", icon)} />
      <div className="min-w-0 flex-1 leading-relaxed text-foreground">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title ? "mt-1" : null, "text-foreground/80")}>{children}</div>}
      </div>
    </div>
  );
}
