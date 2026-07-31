import { cn, statusColor, statusLabel } from "@/lib/utils";
import type { ReactNode } from "react";

export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        status ? statusColor(status) : "bg-slate-100 text-slate-700"
      )}
    >
      {children ?? (status ? statusLabel(status) : null)}
    </span>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = "violet",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "violet" | "sky" | "amber" | "emerald" | "rose";
  icon?: ReactNode;
}) {
  const accents = {
    violet: "from-violet-500/10 to-violet-500/0 text-violet-700",
    sky: "from-sky-500/10 to-sky-500/0 text-sky-700",
    amber: "from-amber-500/10 to-amber-500/0 text-amber-700",
    emerald: "from-emerald-500/10 to-emerald-500/0 text-emerald-700",
    rose: "from-rose-500/10 to-rose-500/0 text-rose-700",
  };
  return (
    <Card className={cn("relative overflow-hidden bg-gradient-to-br", accents[accent])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        {icon ? <div className="rounded-xl bg-white/80 p-2 text-slate-700 shadow-sm">{icon}</div> : null}
      </div>
    </Card>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  type = "button",
  disabled,
  formAction,
  onClick,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  formAction?: (formData: FormData) => void | Promise<void>;
  onClick?: () => void;
}) {
  const variants = {
    primary: "bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-600/20",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      formAction={formAction}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:opacity-50",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-violet-500/30 placeholder:text-slate-400 focus:ring-2",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-violet-500/30 focus:ring-2",
        props.className
      )}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-slate-600">{children}</label>;
}
