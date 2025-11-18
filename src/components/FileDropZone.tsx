import React, { useCallback, useRef } from "react";
import { CloudArrowUpIcon } from "@heroicons/react/24/outline";

type Props = {
  onFiles: (file: File) => void;
  accept?: string;
};

export default function FileDropzone({ onFiles, accept = ".xls,.xlsx,.csv" }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        onFiles(files[0]);
      }
    },
    [onFiles]
  );

  const handleBrowse = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFiles(f);
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="w-full p-4 sm:p-6 border-2 border-dashed rounded-lg bg-white/50 border-slate-200 text-center"
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="w-14 h-14 rounded-lg bg-accent/10 flex items-center justify-center">
          <CloudArrowUpIcon className="w-7 h-7 text-accent" />
        </div>
        <div className="text-sm font-medium text-primary">Upload EWS Framework</div>
        <div className="text-xs text-slate-500 max-w-md">
          Drag & drop your Excel file here or{" "}
          <button type="button" onClick={handleBrowse} className="text-accent font-medium">
            browse
          </button>
        </div>
        <div className="text-xs text-slate-400">Supported: .xlsx, .xls, .csv — first sheet will be parsed</div>
      </div>
    </div>
  );
}
