"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";

interface StatsCounterProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
}

export function StatsCounter({
  label,
  value,
  prefix = "",
  suffix = "",
  delay = 0,
}: StatsCounterProps) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!isInView) return;

    const duration = 2000; // 2 seconds
    const steps = 60;
    const stepDuration = duration / steps;
    const increment = value / steps;
    let current = 0;

    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        current += increment;
        if (current >= value) {
          setCount(value);
          clearInterval(interval);
        } else {
          setCount(current);
        }
      }, stepDuration);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timer);
  }, [isInView, value, delay]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1);
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return Math.round(num).toLocaleString();
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: delay / 1000 }}
      className="text-center"
    >
      <div className="text-3xl md:text-4xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
        {prefix}
        {value < 10 ? count.toFixed(1) : formatNumber(count)}
        {suffix}
      </div>
      <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
    </motion.div>
  );
}
