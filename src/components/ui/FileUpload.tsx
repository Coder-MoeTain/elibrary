import { Upload } from "lucide-react";
import { ChangeEvent, DragEvent, useId, useState } from "react";

type FileUploadProps = {
  label: string;
  accept: string;
  fileName?: string;
  onFileChange: (file: File | null) => void;
};

const FileUpload = ({ label, accept, fileName, onFileChange }: FileUploadProps) => {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  const onSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    onFileChange(file);
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    onFileChange(file);
  };

  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <input id={inputId} type="file" accept={accept} onChange={onSelect} className="sr-only" />
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed px-3 text-sm transition ${
          dragging
            ? "border-primary bg-blue-50 text-primary dark:bg-slate-700"
            : "border-slate-300 bg-white text-slate-600 hover:border-primary/60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
        }`}
      >
        <Upload className="h-4 w-4 shrink-0" />
        <span className="truncate">{fileName || "Drag & drop or click to upload"}</span>
      </label>
    </div>
  );
};

export default FileUpload;
