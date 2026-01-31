"use client";

import { useTranslations } from "next-intl";
import { Shield, Eye, Users } from "lucide-react";

export default function AboutPage() {
  const t = useTranslations("about");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              {t("title")}
            </h1>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              {t("subtitle")}
            </p>
          </div>

          {/* Mission */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              {t("mission.title")}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t("mission.description")}
            </p>
          </div>

          {/* Values */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
              {t("values.title")}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  {t("values.security")}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t("values.securityDesc")}
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                  <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  {t("values.transparency")}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t("values.transparencyDesc")}
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  {t("values.community")}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t("values.communityDesc")}
                </p>
              </div>
            </div>
          </div>

          {/* Team */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              {t("team.title")}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t("team.description")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
