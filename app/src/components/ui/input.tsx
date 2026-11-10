import * as React from "react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { X } from "lucide-react";

interface InputProps extends React.ComponentProps<"input"> {
  onDelete?: () => void;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, onDelete, ...props }, ref) => {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (type == "file") {
      const file = event.target.files?.[0];
      if (props?.accept == "image/*") {
        if (file) {
          setAvatarPreview(URL.createObjectURL(file));
        }
      } else if (props?.accept == ".pdf,.doc,.docx") {
        if (file) {
          setFileName(file.name);
        }
      }
    }
    props.onChange?.(event);
  };

  return (
    <div className={`${avatarPreview ? "flex" : "column"} items-center gap-4`}>
      <input type={type} className={cn("flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className)} ref={ref} {...props} onChange={handleFileChange} />
      {(avatarPreview || fileName) && (
        <div className="relative">
          {avatarPreview && <img src={avatarPreview} alt="Avatar Preview" className="h-16 w-16 rounded-full object-cover border" width={64} height={64} />}
          {fileName && <div className="mt-1">{fileName}</div>}
          <button
            type="button"
            onClick={() => {
              setAvatarPreview(null);
              setFileName(null);
              onDelete?.();
              props.onChange?.(undefined as unknown as React.ChangeEvent<HTMLInputElement>);
            }}
            className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full p-1 shadow hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}
    </div>
  );
});
Input.displayName = "Input";

export { Input };
