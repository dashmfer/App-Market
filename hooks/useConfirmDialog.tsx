"use client";

import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
}

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: "",
    description: "",
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const showConfirm = useCallback(
    (opts: ConfirmOptions): Promise<boolean> => {
      setOptions(opts);
      setOpen(true);
      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
      });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(false);
  }, []);

  const dialog = (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{options.title}</DialogTitle>
          <DialogDescription>{options.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {options.cancelLabel || "Cancel"}
          </Button>
          <Button
            variant={
              options.variant === "destructive" ? "destructive" : "default"
            }
            onClick={handleConfirm}
          >
            {options.confirmLabel || "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return [dialog, showConfirm] as const;
}
