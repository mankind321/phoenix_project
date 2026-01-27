/* eslint-disable @typescript-eslint/no-explicit-any */

import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

export const runtime = "nodejs";
process.env.GAX_GCN_DISALLOW_IPv6 = "true";

import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";

/* ----------------------------------
   Environment Validation
---------------------------------- */
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  throw new Error("Missing GOOGLE_APPLICATION_CREDENTIALS_JSON");
}

if (!process.env.GOOGLE_BUCKET_PROFILE) {
  throw new Error("Missing GOOGLE_BUCKET_PROFILE");
}

/* ----------------------------------
   GCP Storage Initialization
---------------------------------- */
const credentials = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
);

const storage = new Storage({
  projectId: credentials.project_id,
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
  },
});

const bucket = storage.bucket(process.env.GOOGLE_BUCKET_PROFILE);

/* ----------------------------------
   GET Handler
---------------------------------- */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawPath = searchParams.get("path");

    /* -------------------------------
       Path Validation
    -------------------------------- */
    if (!rawPath || rawPath === "undefined" || rawPath.trim() === "") {
      return NextResponse.json(
        { success: false, message: "Missing or invalid file path" },
        { status: 400 }
      );
    }

    // Decode URL encoding (%2F, etc.)
    const decodedPath = decodeURIComponent(rawPath);
    let cleanPath = decodedPath;

    /* -------------------------------
       Handle Full GCS URLs
    -------------------------------- */
    if (decodedPath.startsWith("http")) {
      const match = decodedPath.match(/\/uploads\/(.+?)(\?|$)/);
      if (!match || !match[1]) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid URL format (missing /uploads/ segment)",
          },
          { status: 400 }
        );
      }
      cleanPath = `uploads/${match[1]}`;
    }

    /* -------------------------------
       Final Sanity Check
    -------------------------------- */
    if (!cleanPath || cleanPath.includes("undefined")) {
      return NextResponse.json(
        { success: false, message: "Invalid resolved file path" },
        { status: 400 }
      );
    }

    const file = bucket.file(cleanPath);

    /* -------------------------------
       Existence Check
    -------------------------------- */
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json(
        {
          success: false,
          message: `File not found: ${cleanPath}`,
        },
        { status: 404 }
      );
    }

    /* -------------------------------
       Signed URL Generation
    -------------------------------- */
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return NextResponse.json({
      success: true,
      url: signedUrl,
      expires_in: 3600,
    });
  } catch (error: any) {
    console.error("getSignedUrl error:", error);

    return NextResponse.json(
      {
        success: false,
        message: `GCP error: ${error.message}`,
      },
      { status: 500 }
    );
  }
}
