/**
 * Microsoft Graph API client for OneDrive file operations.
 *
 * Uses client-credentials (app-only) flow to upload photos into a structured
 * folder hierarchy on the configured user's OneDrive:
 *
 *   {ONEDRIVE_ROOT_FOLDER}/{customerName}/{kenteken} - {repairCode}/
 */

// ─── Token cache ────────────────────────────────────────────────────────────

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }

  const tenantId = process.env.MICROSOFT_TENANT_ID!;
  const clientId = process.env.MICROSOFT_CLIENT_ID!;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get Microsoft access token: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.accessToken;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function userDrivePath(): string {
  const email = process.env.ONEDRIVE_USER_EMAIL!;
  return `${GRAPH_BASE}/users/${email}/drive`;
}

/** Sanitize a folder/file name for OneDrive (remove illegal chars) */
function sanitizeName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface OneDriveUploadResult {
  /** Direct download URL (public, short-lived) */
  downloadUrl: string;
  /** Web URL to view the file in OneDrive browser */
  webUrl: string;
  /** Web URL for the parent folder */
  folderWebUrl: string;
  /** The full path within OneDrive */
  drivePath: string;
  /** OneDrive item id */
  itemId: string;
}

/**
 * Build the folder path for a repair job's photos.
 */
export function buildRepairFolderPath(opts: {
  customerName?: string | null;
  unitRegistration?: string | null;
  repairCode?: string | null;
}): string {
  const root = process.env.ONEDRIVE_ROOT_FOLDER ?? "Reparaties";
  const customer = sanitizeName(opts.customerName || "Onbekend");

  const parts: string[] = [];
  if (opts.unitRegistration) parts.push(sanitizeName(opts.unitRegistration));
  if (opts.repairCode) parts.push(sanitizeName(opts.repairCode));

  const subFolder = parts.length > 0 ? parts.join(" - ") : sanitizeName(opts.repairCode || "Algemeen");

  return `${root}/${customer}/${subFolder}`;
}

/**
 * Ensure a folder path exists in OneDrive (creates intermediate folders).
 * Returns the web URL of the deepest folder.
 */
export async function ensureFolder(folderPath: string): Promise<string> {
  const token = await getAccessToken();

  // Try to get the folder first – if it exists, return immediately
  const checkRes = await fetch(
    `${userDrivePath()}/root:/${encodeURIComponent(folderPath).replace(/%2F/g, "/")}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (checkRes.ok) {
    const data = await checkRes.json();
    return data.webUrl as string;
  }

  // Folder doesn't exist – create it by creating each segment
  const segments = folderPath.split("/");
  let parentPath = "";
  let webUrl = "";

  for (const segment of segments) {
    const currentPath = parentPath ? `${parentPath}/${segment}` : segment;

    const createRes = await fetch(
      parentPath
        ? `${userDrivePath()}/root:/${encodeURIComponent(parentPath).replace(/%2F/g, "/")}:/children`
        : `${userDrivePath()}/root/children`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: segment,
          folder: {},
          "@microsoft.graph.conflictBehavior": "replace",
        }),
      }
    );

    if (createRes.ok) {
      const data = await createRes.json();
      webUrl = data.webUrl;
    } else if (createRes.status === 409) {
      // Already exists – get its webUrl
      const getRes = await fetch(
        `${userDrivePath()}/root:/${encodeURIComponent(currentPath).replace(/%2F/g, "/")}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (getRes.ok) {
        const data = await getRes.json();
        webUrl = data.webUrl;
      }
    } else {
      const text = await createRes.text();
      throw new Error(`Failed to create folder "${currentPath}": ${createRes.status} ${text}`);
    }

    parentPath = currentPath;
  }

  return webUrl;
}

/**
 * Upload a file (Buffer) to OneDrive.
 *
 * For files ≤ 4 MB uses simple upload; larger files use an upload session.
 */
export async function uploadFile(
  folderPath: string,
  fileName: string,
  fileBuffer: Uint8Array,
  contentType: string
): Promise<OneDriveUploadResult> {
  const token = await getAccessToken();
  const safeName = sanitizeName(fileName);
  const fullPath = `${folderPath}/${safeName}`;

  // Ensure folder exists and get its webUrl
  const folderWebUrl = await ensureFolder(folderPath);

  let itemData: any;

  if (fileBuffer.length <= 4 * 1024 * 1024) {
    // Simple upload (≤ 4 MB)
    const res = await fetch(
      `${userDrivePath()}/root:/${encodeURIComponent(fullPath).replace(/%2F/g, "/")}:/content`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": contentType,
        },
        body: new Uint8Array(fileBuffer),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OneDrive upload failed: ${res.status} ${text}`);
    }

    itemData = await res.json();
  } else {
    // Large file – use upload session
    const sessionRes = await fetch(
      `${userDrivePath()}/root:/${encodeURIComponent(fullPath).replace(/%2F/g, "/")}:/createUploadSession`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: {
            "@microsoft.graph.conflictBehavior": "rename",
            name: safeName,
          },
        }),
      }
    );

    if (!sessionRes.ok) {
      const text = await sessionRes.text();
      throw new Error(`Failed to create upload session: ${sessionRes.status} ${text}`);
    }

    const { uploadUrl } = await sessionRes.json();

    // Upload in 4 MB chunks
    const chunkSize = 4 * 1024 * 1024;
    const totalSize = fileBuffer.length;
    let offset = 0;

    while (offset < totalSize) {
      const end = Math.min(offset + chunkSize, totalSize);
      const chunk = fileBuffer.subarray(offset, end);

      const chunkRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Range": `bytes ${offset}-${end - 1}/${totalSize}`,
          "Content-Length": String(chunk.length),
        },
        body: new Uint8Array(chunk),
      });

      if (chunkRes.status === 200 || chunkRes.status === 201) {
        // Final chunk – contains the item data
        itemData = await chunkRes.json();
      } else if (chunkRes.status !== 202) {
        const text = await chunkRes.text();
        throw new Error(`Chunk upload failed: ${chunkRes.status} ${text}`);
      }

      offset = end;
    }
  }

  // Create a sharing link so the image is viewable
  const shareRes = await fetch(
    `${GRAPH_BASE}/users/${process.env.ONEDRIVE_USER_EMAIL!}/drive/items/${itemData.id}/createLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "view",
        scope: "anonymous",
      }),
    }
  );

  let downloadUrl = itemData["@microsoft.graph.downloadUrl"] || itemData.webUrl;
  if (shareRes.ok) {
    const shareData = await shareRes.json();
    // Convert sharing link to direct download URL for embedding
    const shareUrl = shareData.link?.webUrl;
    if (shareUrl) {
      // Use the embed URL format for direct image access
      downloadUrl = shareUrl;
    }
  }

  return {
    downloadUrl,
    webUrl: itemData.webUrl,
    folderWebUrl,
    drivePath: fullPath,
    itemId: itemData.id,
  };
}

/**
 * Get the web URL for a repair's OneDrive folder.
 * Returns null if the folder doesn't exist yet.
 */
export async function getRepairFolderUrl(folderPath: string): Promise<string | null> {
  try {
    const token = await getAccessToken();
    const res = await fetch(
      `${userDrivePath()}/root:/${encodeURIComponent(folderPath).replace(/%2F/g, "/")}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const data = await res.json();
      return data.webUrl as string;
    }
    return null;
  } catch {
    return null;
  }
}
