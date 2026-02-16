export async function register() {
  // Validate environment variables at startup (server-side only)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnvironment } = await import("@/lib/env-validation");
    assertEnvironment();
  }
}
