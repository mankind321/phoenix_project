/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Storage } from "@google-cloud/storage";
import { logAuditTrail } from "@/lib/auditLogger";

const credentials = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!
);

const storage = new Storage({
  projectId: credentials.project_id,
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
  },
});

const bucket = storage.bucket(process.env.GOOGLE_BUCKET_DOCUMENT!);

/* ============================================================
   SHARED VALIDATION FUNCTION
============================================================ */
async function validateAndGetFile(req: Request) {
  // Validate session
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user) {
    return {
      error: NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  // Get file path
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("path");

  if (!filePath) {
    return {
      error: NextResponse.json(
        { success: false, message: "Missing file path" },
        { status: 400 }
      ),
    };
  }

  // Normalize path
  const cleanPath = filePath
    .replace("gs://", "")
    .replace(process.env.GOOGLE_BUCKET_DOCUMENT + "/", "")
    .replace(/^\/+/, "");

  const file = bucket.file(cleanPath);

  const [exists] = await file.exists();

  if (!exists) {
    return {
      error: NextResponse.json(
        { success: false, message: "File not found in GCP" },
        { status: 404 }
      ),
    };
  }

  return {
    file,
    cleanPath,
    user,
  };
}

/* ============================================================
   HEAD METHOD (for availability check)
============================================================ */
export async function HEAD(req: Request) {
  try {
    const result = await validateAndGetFile(req);

    if (result.error) return result.error;

    return new NextResponse(null, {
      status: 200,
    });

  } catch (error: any) {
    console.error("❌ File HEAD check failed:", error);

    return new NextResponse(null, {
      status: 500,
    });
  }
}

/* ============================================================
   GET METHOD (actual download)
============================================================ */
export async function GET(req: Request) {
  try {
    const result = await validateAndGetFile(req);

    if (result.error) return result.error;

    const { file, cleanPath, user } = result;

    // Download file
    const [contents] = await file.download();

    const fileName = cleanPath.split("/").pop() ?? "download";

    // Audit log
    await logAuditTrail({
      userId: user.id,
      username: user.username,
      role: user.role,
      actionType: "DOWNLOAD",
      tableName: "document_user",
      description: `Downloaded file: ${fileName}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return new Response(new Uint8Array(contents), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });

  } catch (error: any) {
    console.error("❌ File download failed:", error);

    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
