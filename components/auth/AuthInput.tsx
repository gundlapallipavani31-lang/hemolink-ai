import type { InputHTMLAttributes } from "react";

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function AuthInput({ id, label, hint, ...props }: AuthInputProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">{label}</label>
      <input
        id={id}
        {...props}
        className="h-12 w-full rounded-[0.7rem] border border-border-strong bg-surface px-3.5 text-sm text-foreground shadow-xs outline-none transition placeholder:text-foreground-subtle hover:border-[#b9aaa1] focus:border-medical focus:ring-4 focus:ring-red-100"
      />
      {hint && <p className="text-xs text-foreground-subtle">{hint}</p>}
    </div>
  );
}
