"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, AlertCircle } from "lucide-react";

interface ScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected?: (code: string) => void;
}

export function ScanDialog({ open, onOpenChange, onDetected }: ScanDialogProps) {
  const [hasSupport, setHasSupport] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return;
    }

    // Check BarcodeDetector support
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      setHasSupport(false);
      return;
    }

    setHasSupport(true);
    let active = true;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch((err) => {
        setErrorMsg(err?.message || "Unable to access camera.");
      });

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-brand" />
            Scan a product
          </DialogTitle>
          <DialogDescription>
            Point your camera at a barcode or label to find the product on LuxeBeau.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-4">
          {!hasSupport ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center text-muted">
              <AlertCircle className="h-10 w-10 text-muted" />
              <p className="text-[14px]">
                Scanning isn&apos;t supported on this device or browser.
              </p>
              <p className="text-[12px] text-muted">
                You can still type the product name or brand into search!
              </p>
            </div>
          ) : errorMsg ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-destructive">
              <AlertCircle className="h-8 w-8" />
              <p className="text-[14px]">{errorMsg}</p>
            </div>
          ) : (
            <div className="relative aspect-square w-full max-w-[280px] overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
              />
              <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-brand shadow-[0_0_8px_var(--color-brand)] animate-pulse" />
            </div>
          )}

          <Button
            variant="outline"
            className="mt-4"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
