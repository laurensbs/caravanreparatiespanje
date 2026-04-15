import { type NextRequest, NextResponse } from "next/server";
import { clearGarageSession } from "@/lib/garage-auth";

/**
 * Clears the garage PIN session cookie so admins always see the PIN form
 * when navigating to the garage portal from the sidebar.
 */
export async function GET(request: NextRequest) {
  await clearGarageSession();
  const url = new URL("/garage", request.url);
  return NextResponse.redirect(url);
}
