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

const bucketName = process.env.GOOGLE_BUCKET_DOCUMENT!;
const bucket = storage.bucket(bucketName);

/* ============================================================
   NORMALIZE FILE PATH SAFELY
============================================================ */
function normalizePath(rawPath: string) {
  if (!rawPath) return "";

  let path = decodeURIComponent(rawPath).trim();

  // Remove gs://bucket/
  if (path.startsWith("gs://")) {
    path = path.replace(`gs://${bucketName}/`, "");
  }

  // Remove https://storage.googleapis.com/bucket/
  if (path.includes("storage.googleapis.com")) {
    const parts = path.split(`/${bucketName}/`);
    path = parts.length > 1 ? parts[1] : "";
  }

  // Remove accidental bucket duplication
  if (path.startsWith(bucketName + "/")) {
    path = path.replace(bucketName + "/", "");
  }

  // Remove leading slashes
  path = path.replace(/^\/+/, "");

  return path;
}

/* ============================================================
   SHARED VALIDATION FUNCTION
============================================================ */
async function validateAndGetFile(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const rawPath = searchParams.get("path");

  if (!rawPath) {
    return {
      error: NextResponse.json(
        { success: false, message: "Missing file path" },
        { status: 400 }
      ),
    };
  }

  const cleanPath = normalizePath(rawPath);

  if (!cleanPath) {
    return {
      error: NextResponse.json(
        { success: false, message: "Invalid file path" },
        { status: 400 }
      ),
    };
  }

  console.log("🔎 Normalized GCP path:", cleanPath);

  const file = bucket.file(cleanPath);
  const [exists] = await file.exists();

  if (!exists) {
    return {
      error: NextResponse.json(
        { success: false, message: "Document not found." },
        { status: 404 }
      ),
    };
  }

  return { file, cleanPath, user };
}

/* ============================================================
   HEAD METHOD (for availability check)
============================================================ */
export async function HEAD(req: Request) {
  try {
    const result = await validateAndGetFile(req);
    if (result.error) return result.error;

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("❌ File HEAD check failed:", error);
    return new NextResponse(null, { status: 500 });
  }
}

/* ============================================================
   GET METHOD (STREAM DOWNLOAD - MEMORY SAFE)
============================================================ */
export async function GET(req: Request) {
  try {
    const result = await validateAndGetFile(req);
    if (result.error) return result.error;

    const { file, cleanPath, user } = result;
    const fileName = cleanPath.split("/").pop() ?? "download";

    // Audit log (before streaming)
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

    const stream = file.createReadStream();

    return new Response(stream as any, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("❌ File download failed:", error);

    return NextResponse.json(
      { success: false, message: "Failed to download document." },
      { status: 500 }
    );
  }
}