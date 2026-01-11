"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface HowItWorksStepProps {
  step: number;
  title: string;
  description: string;
  icon: LucideIcon;
  index?: number;
}

export function HowItWorksStep({
  step,
  title,
  description,
  icon: Icon,
  index = 0,
}: HowItWorksStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative"
    >
      {/* Connector line (hidden on last item and mobile) */}
      {index < 3 && (
        <div className="hidden lg:block absolute top-10 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-gradient-to-r from-zinc-300 dark:from-zinc-700 to-transparent" />
      )}

      <div className="text-center">
        {/* Step number with icon */}
        <div className="relative inline-flex">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
            <Icon className="w-8 h-8 text-white" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black text-sm font-bold flex items-center justify-center">
            {step}
          </div>
        </div>

        {/* Content */}
        <h3 className="mt-6 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
          {description}
        </p>
      </div>
    </motion.div>
  );
}
