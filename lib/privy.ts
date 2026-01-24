import { PrivyClient } from "@privy-io/server-auth";

// Server-side Privy client for verifying tokens
export const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID || "",
  process.env.PRIVY_APP_SECRET || ""
);

// Verify a Privy access token and return the user
export async function verifyPrivyToken(accessToken: string) {
  try {
    const verifiedClaims = await privyClient.verifyAuthToken(accessToken);
    return verifiedClaims;
  } catch (error) {
    console.error("Failed to verify Privy token:", error);
    return null;
  }
}

// Get user by Privy ID
export async function getPrivyUser(privyUserId: string) {
  try {
    const user = await privyClient.getUser(privyUserId);
    return user;
  } catch (error) {
    console.error("Failed to get Privy user:", error);
    return null;
  }
}
