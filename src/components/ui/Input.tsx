import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
};

export default function Input({ label, error, className, ...rest }: InputProps) {
  return (
    <div className={`w-full ${className ?? ""}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {label}
        </label>
      )}

      <input
        {...rest}
        className="
          w-full px-3 py-2 rounded-lg border 
          border-slate-300 bg-white text-slate-800
          placeholder-slate-400

          focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent

          dark:bg-[#0d2640] dark:border-slate-700 dark:text-slate-200
          dark:placeholder-slate-500 dark:focus:ring-blue-400
        "
      />

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
