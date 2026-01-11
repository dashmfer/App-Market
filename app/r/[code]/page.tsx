import { redirect } from "next/navigation";
import { cookies } from "next/headers";

// This page handles referral links: /r/[code]
// It sets a cookie to track the referrer and redirects to signup

export default async function ReferralPage({
  params,
}: {
  params: { code: string };
}) {
  const { code } = params;

  // Set referral cookie (lasts 30 days)
  cookies().set("referral_code", code, {
    maxAge: 30 * 24 * 60 * 60, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  // Redirect to home or signup page
  redirect("/?ref=" + code);
}
