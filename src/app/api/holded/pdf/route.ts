import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isHoldedConfigured } from "@/lib/holded/client";
import { getInvoicePdf, getQuotePdf } from "@/lib/holded/invoices";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isHoldedConfigured()) {
    return NextResponse.json({ error: "Holded not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "invoice" or "estimate"
  const id = searchParams.get("id");

  if (!type || !id || !["invoice", "estimate"].includes(type)) {
    return NextResponse.json({ error: "Missing type or id" }, { status: 400 });
  }

  // Validate id format (should be a hex string)
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });
  }

  try {
    const buf = type === "invoice"
      ? await getInvoicePdf(id)
      : await getQuotePdf(id);

    if (buf.length === 0) {
      return NextResponse.json({ error: "Empty PDF returned from Holded" }, { status: 502 });
    }

    // Verify it starts with %PDF
    const header = buf.subarray(0, 5).toString("ascii");
    if (!header.startsWith("%PDF")) {
      console.error("Holded PDF response is not a PDF:", buf.subarray(0, 200).toString("utf8"));
      return NextResponse.json({ error: "Holded did not return a valid PDF" }, { status: 502 });
    }

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buf.length),
        "Content-Disposition": `inline; filename="${type}-${id}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e: any) {
    console.error("PDF fetch error:", e);
    const status = e.status ?? 500;
    if (status === 404) {
      return NextResponse.json({ error: "Document not found in Holded" }, { status: 404 });
    }
    return NextResponse.json({ error: e.message ?? "Failed to fetch PDF" }, { status });
  }
}
