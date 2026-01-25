"use client";

import { AlertTriangle, Shield, FileWarning } from "lucide-react";

interface SecurityNoticeProps {
  variant?: "warning" | "info";
  className?: string;
}

export function SecurityNotice({ variant = "warning", className = "" }: SecurityNoticeProps) {
  const isWarning = variant === "warning";

  return (
    <div
      className={`rounded-lg border p-4 ${
        isWarning
          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
          : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${isWarning ? "text-amber-600" : "text-blue-600"}`}>
          {isWarning ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <Shield className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1">
          <h4
            className={`font-medium mb-1 ${
              isWarning ? "text-amber-800 dark:text-amber-200" : "text-blue-800 dark:text-blue-200"
            }`}
          >
            Security Notice
          </h4>
          <ul
            className={`text-sm space-y-1 ${
              isWarning ? "text-amber-700 dark:text-amber-300" : "text-blue-700 dark:text-blue-300"
            }`}
          >
            <li className="flex items-start gap-2">
              <FileWarning className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Always scan downloaded files with antivirus software before opening</span>
            </li>
            <li className="flex items-start gap-2">
              <FileWarning className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Be cautious of archive files (.zip, .rar) - extract and scan contents first</span>
            </li>
            <li className="flex items-start gap-2">
              <FileWarning className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Never run executable files from untrusted sources</span>
            </li>
            <li className="flex items-start gap-2">
              <FileWarning className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>If anything seems suspicious, contact support before proceeding</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
