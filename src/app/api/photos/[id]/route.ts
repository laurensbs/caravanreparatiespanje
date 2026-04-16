import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { repairPhotos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );

  if (!res.ok) throw new Error("Failed to get access token");
  const data = await res.json();
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Look up the photo record
  const [photo] = await db
    .select({ onedriveItemId: repairPhotos.onedriveItemId })
    .from(repairPhotos)
    .where(eq(repairPhotos.id, id))
    .limit(1);

  if (!photo?.onedriveItemId) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const token = await getAccessToken();
    const email = process.env.ONEDRIVE_USER_EMAIL!;

    // Get direct download URL from Graph API
    const res = await fetch(
      `${GRAPH_BASE}/users/${email}/drive/items/${photo.onedriveItemId}/content`,
      {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "manual",
      }
    );

    if (res.status === 302) {
      const location = res.headers.get("location");
      if (location) {
        // Redirect to the CDN URL (cached, fast)
        return NextResponse.redirect(location, { status: 302, headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        }});
      }
    }

    // Fallback: stream the content directly
    const contentRes = await fetch(
      `${GRAPH_BASE}/users/${email}/drive/items/${photo.onedriveItemId}/content`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!contentRes.ok) {
      return new NextResponse("Failed to fetch image", { status: 502 });
    }

    return new NextResponse(contentRes.body, {
      headers: {
        "Content-Type": contentRes.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("Photo proxy error:", err);
    return new NextResponse("Failed to fetch image", { status: 500 });
  }
}
