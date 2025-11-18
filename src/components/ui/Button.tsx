import React from "react";
import clsx from "clsx";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  fullWidth?: boolean;
};

const classes = {
  base: "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-[#071b2c]",

  primary: "bg-blue-700 text-white hover:bg-blue-800 active:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700",

  ghost:
    "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 dark:bg-transparent dark:text-blue-300 dark:border-blue-600 dark:hover:bg-blue-900/30",

  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
};

export default function Button({ variant = "primary", fullWidth, className, ...rest }: ButtonProps) {
  return (
    <button
      className={clsx(
        classes.base,
        classes[variant],
        fullWidth ? "w-full" : "inline-flex",
        className
      )}
      {...rest}
    />
  );
}
