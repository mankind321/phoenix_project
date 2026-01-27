/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";
import { createClient } from "@supabase/supabase-js";

const DISPATCHER_SIGNED_URL =
  "https://upload-dispatcher-283806001440.us-west2.run.app/preupload/signed-url";

// ----------------------------------------------
// 🔑 SERVICE ROLE CLIENT (READ-ONLY CHECK)
// ----------------------------------------------
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    console.log("======================================");
    console.log("📥 Incoming Upload Request (FE → BE)");
    console.log("======================================");

    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ Parse form-data
    const form = await req.formData();
    const file = form.get("file") as File;
    const documentType = form.get("document_type") as string;

    if (!file || !documentType) {
      return NextResponse.json(
        { success: false, message: "Missing file or document_type" },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const contentType = file.type || "application/octet-stream";

    // ----------------------------------------------
    // 🛑 PRE-CHECK: FAILED EXTRACTION GUARD
    // ----------------------------------------------
    const { data: failedDoc, error: failedCheckError } =
      await supabaseAdmin
        .from("document_registry")
        .select("file_id, extraction_status")
        .eq("file_name", fileName)
        .eq("extraction_status", "FAILED")
        .limit(1)
        .maybeSingle();

    if (failedCheckError) {
      console.error("❌ document_registry check failed:", failedCheckError);
      return NextResponse.json(
        { success: false, message: "Failed to validate document status" },
        { status: 500 }
      );
    }

    if (failedDoc) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This document was previously processed but failed extraction. Please delete the existing record from the Error Handling page.",
        },
        { status: 409 } // Conflict
      );
    }

    // ----------------------------------------------
    // 3️⃣ Continue normal upload flow
    // ----------------------------------------------
    const filePath = `uploads/${Date.now()}_${fileName.replace(/\s+/g, "_")}`;

    const metadata = {
      file_name: fileName,
      file_path: filePath,
      bucket_name: process.env.GOOGLE_BUCKET_DOCUMENT,
      content_type: contentType,
      upload_timestamp: new Date().toISOString(),
      user_id: session.user.id,
      session_id: session.session_id,
      service_key_role: session.user.role.toLowerCase(),
      document_type: documentType,
    };

    console.log("📝 Sending metadata to Dispatcher:", metadata);

    // 4️⃣ Dispatcher validation + signed URL
    const dispatcherRes = await fetch(DISPATCHER_SIGNED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    });

    const dispatcherJson = await dispatcherRes.json();
    console.log("⬅ Dispatcher response:", dispatcherJson);

    if (!dispatcherRes.ok || dispatcherJson.status !== "success") {
      return NextResponse.json(
        {
          success: false,
          message: "Dispatcher validation failed",
          dispatcher: dispatcherJson,
        },
        { status: dispatcherRes.status }
      );
    }

    const { signed_url, upload_path } = dispatcherJson;

    // 5️⃣ Upload to GCS
    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadRes = await fetch(signed_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: buffer,
    });

    if (!uploadRes.ok) {
      console.error("❌ GCS upload failed:", await uploadRes.text());
      return NextResponse.json(
        { success: false, message: "File upload to GCS failed" },
        { status: 500 }
      );
    }

    console.log("✅ File uploaded successfully");

    // 6️⃣ Audit Trail
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "UPLOAD",
      tableName: "document",
      description: `Uploaded document: ${fileName}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    // 7️⃣ Response
    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      bucket_name: metadata.bucket_name,
      file_path: upload_path,
      metadata,
    });
  } catch (error: any) {
    console.error("🔥 Upload error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
