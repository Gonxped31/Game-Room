import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  /** The Defendant's disabled button uses a warm gray instead of the default blue-leaning one. */
  warmDisabled?: boolean;
}

const base = "w-full cursor-pointer rounded-[14px] border-2 border-[#1C1F3D] font-[family-name:var(--font-archivo)] disabled:cursor-not-allowed";

const variants: Record<string, string> = {
  primary: "h-14 bg-[#FFD23A] text-lg font-extrabold text-[#1C1F3D] shadow-[0_4px_0_#1C1F3D] active:translate-y-1 active:shadow-none",
  secondary: "h-[52px] bg-transparent text-base font-bold text-[#1C1F3D]",
};

const disabledVariants: Record<string, string> = {
  default: "disabled:translate-y-0 disabled:bg-[#DDE1EE] disabled:text-[#5C6286] disabled:shadow-none",
  warm: "disabled:translate-y-0 disabled:bg-[#E6DFE0] disabled:text-[#6B5A5C] disabled:shadow-none",
};

export default function Button({ variant = "primary", warmDisabled = false, className = "", ...rest }: ButtonProps) {
  const disabledClass = variant === "primary" ? disabledVariants[warmDisabled ? "warm" : "default"] : "";
  return <button type="button" className={`${base} ${variants[variant]} ${disabledClass} ${className}`} {...rest} />;
}
