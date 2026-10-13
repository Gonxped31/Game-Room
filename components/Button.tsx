import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "alt" | "sm";
}

const base = "cursor-pointer rounded-xl border-0 font-bold";
const variants: Record<string, string> = {
  primary:
    "mt-2.5 w-full bg-[#FF3D8F] p-3.5 text-lg text-white shadow-[0_4px_0_#a3125b] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:bg-[#0a5b62] disabled:text-[#8fc3c7] disabled:shadow-none",
  alt: "mt-2.5 w-full bg-white p-3.5 text-lg text-black shadow-[0_4px_0_rgba(0,0,0,.3)] active:translate-y-[3px] active:shadow-none",
  sm: "mr-2 mt-2 bg-white px-3.5 py-2 text-sm text-black shadow-[0_4px_0_rgba(0,0,0,.3)] active:translate-y-[3px] active:shadow-none",
};

export default function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  return <button type="button" className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}
