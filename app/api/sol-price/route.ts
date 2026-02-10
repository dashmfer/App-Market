import { NextResponse } from "next/server";
import { getSolPriceUsd } from "@/lib/sol-price";

export async function GET() {
  const price = await getSolPriceUsd();
  if (price === null) {
    return NextResponse.json({ error: "Unable to fetch SOL price" }, { status: 503 });
  }
  return NextResponse.json({ price });
}
