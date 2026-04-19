import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export const Button = ({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "accent" }) => (
  <button
    className={cn(
      variant === "primary" && "button-primary",
      variant === "secondary" && "button-secondary",
      variant === "accent" && "button-accent",
      className,
    )}
    {...props}
  />
);

export const Card = ({
  className,
  muted = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { muted?: boolean }) => (
  <div className={cn(muted ? "panel-muted" : "panel", className)} {...props} />
);

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("text-input", className)} {...props} />
));
Input.displayName = "Input";

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("text-area", className)} {...props} />
));
TextArea.displayName = "TextArea";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn("filter-select", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export const Badge = ({
  className,
  tone = "slate",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "slate" | "teal" | "saffron" | "moss" | "coral" }) => (
  <span
    className={cn(
      "badge",
      tone === "slate" && "bg-slate-100 text-slate-700",
      tone === "teal" && "bg-teal/10 text-teal",
      tone === "saffron" && "bg-saffron/15 text-amber-700",
      tone === "moss" && "bg-moss/10 text-moss",
      tone === "coral" && "bg-coral/10 text-coral",
      className,
    )}
    {...props}
  />
);
