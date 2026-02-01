"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export function Tooltip({
  content,
  children,
  position = "top",
  delay = 200,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const updatePosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    let x = rect.left + scrollX + rect.width / 2;
    let y = rect.top + scrollY;

    switch (position) {
      case "bottom":
        y = rect.bottom + scrollY + 8;
        break;
      case "left":
        x = rect.left + scrollX - 8;
        y = rect.top + scrollY + rect.height / 2;
        break;
      case "right":
        x = rect.right + scrollX + 8;
        y = rect.top + scrollY + rect.height / 2;
        break;
      default: // top
        y = rect.top + scrollY - 8;
        break;
    }

    setCoords({ x, y });
  };

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const getTransformOrigin = () => {
    switch (position) {
      case "bottom":
        return "top center";
      case "left":
        return "right center";
      case "right":
        return "left center";
      default:
        return "bottom center";
    }
  };

  const getTransform = () => {
    switch (position) {
      case "bottom":
        return "translate(-50%, 0)";
      case "left":
        return "translate(-100%, -50%)";
      case "right":
        return "translate(0, -50%)";
      default:
        return "translate(-50%, -100%)";
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-flex"
      >
        {children}
      </div>
      {isVisible &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{
              position: "absolute",
              left: coords.x,
              top: coords.y,
              transform: getTransform(),
              transformOrigin: getTransformOrigin(),
              zIndex: 9999,
            }}
            className="px-2 py-1 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-800 rounded-md shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
