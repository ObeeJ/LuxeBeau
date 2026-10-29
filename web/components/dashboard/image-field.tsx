"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "@/components/icons";
import { Photo } from "@/components/site/catalog";
import { FieldError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { useImageUpload } from "@/lib/queries";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

/* Photo picker: uploads straight to Cloudflare Images and reports the
   delivery URL. The API only accepts URLs from LuxeBeau's image account. */
export function ImageField({
  value,
  onChange,
  label,
  round = false,
}: {
  value?: string;
  onChange: (url: string) => void;
  label: string;
  round?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useImageUpload();
  const [error, setError] = useState("");

  return (
    <div>
      <span className="t-meta mb-1.5 block font-normal">{label}</span>
      <div className="flex items-center gap-4">
        <div className={cn("h-20 w-20 shrink-0", round && "[&>*]:rounded-full")}>
          <Photo src={value} alt={label} fallback="" sizes="sm" className={round ? "rounded-full" : "rounded-[16px]"} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={upload.isPending} onClick={() => input.current?.click()}>
            {upload.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
            {value ? "Replace photo" : "Upload photo"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>Remove</Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError("");
            upload.mutate(file, {
              onSuccess: onChange,
              onError: err => setError(getFriendlyErrorMessage(err, "The upload didn't finish. Please try again.")),
            });
          }}
        />
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}
