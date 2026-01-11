"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface CategoryCardProps {
  category: {
    name: string;
    slug: string;
    count: number;
    icon: string;
  };
  index?: number;
}

export function CategoryCard({ category, index = 0 }: CategoryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link
        href={`/explore?category=${category.slug}`}
        className="block group"
      >
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-green-500/50 dark:hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/5 transition-all duration-300">
          <div className="w-14 h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300">
            {category.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
              {category.name}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {category.count} projects
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-zinc-400 group-hover:text-green-500 group-hover:translate-x-1 transition-all duration-300" />
        </div>
      </Link>
    </motion.div>
  );
}
