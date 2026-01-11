"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "hsl(var(--background))",
          color: "hsl(var(--foreground))",
          border: "1px solid hsl(var(--border))",
        },
        classNames: {
          toast: "rounded-xl shadow-lg",
          title: "font-medium",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
