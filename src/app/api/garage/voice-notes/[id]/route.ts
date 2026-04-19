import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { voiceNotes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Plays back a voice note stored on OneDrive. Mirrors src/app/api/photos/[id]
 * so caching, CDN redirects and Graph token logic stay consistent. We do not
 * gate this with auth — voice note URLs are unguessable UUIDs and the audio
 * is only meaningful in context of the repair it was recorded for.
 */
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
    },
  );
  if (!res.ok) throw new Error("Failed to get access token");
  const data = await res.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.accessToken;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [row] = await db
    .select({
      onedriveItemId: voiceNotes.onedriveItemId,
      mimeType: voiceNotes.mimeType,
    })
    .from(voiceNotes)
    .where(eq(voiceNotes.id, id))
    .limit(1);

  if (!row?.onedriveItemId) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const token = await getAccessToken();
    const email = process.env.ONEDRIVE_USER_EMAIL!;

    const res = await fetch(
      `${GRAPH_BASE}/users/${email}/drive/items/${row.onedriveItemId}/content`,
      { headers: { Authorization: `Bearer ${token}` }, redirect: "manual" },
    );

    if (res.status === 302) {
      const location = res.headers.get("location");
      if (location) {
        return NextResponse.redirect(location, {
          status: 302,
          headers: {
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          },
        });
      }
    }

    const contentRes = await fetch(
      `${GRAPH_BASE}/users/${email}/drive/items/${row.onedriveItemId}/content`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!contentRes.ok) {
      return new NextResponse("Failed to fetch audio", { status: 502 });
    }
    return new NextResponse(contentRes.body, {
      headers: {
        "Content-Type":
          contentRes.headers.get("content-type") ||
          row.mimeType ||
          "audio/webm",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("Voice note proxy error:", err);
    return new NextResponse("Failed to fetch audio", { status: 500 });
  }
}
