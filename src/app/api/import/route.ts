import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runImportPipeline } from "@/actions/import";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !["admin", "manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!allowedTypes.includes(file.type) && !/\.(xlsx|xls)$/i.test(file.name)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload .xlsx or .xls" },
        { status: 400 }
      );
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await runImportPipeline(buffer, file.name, session.user.id);

    return NextResponse.json(result);
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json(
      { error: "Failed to process import" },
      { status: 500 }
    );
  }
}
