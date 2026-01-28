/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    const payload = {
      aud: "authenticated",
      role: "authenticated",
      sub: session.user.id,            // ✅ MUST match document_registry.user_id
      exp: now + 60 * 60,               // ✅ 1 hour expiry
      iat: now,
    };

    const token = jwt.sign(
      payload,
      process.env.SUPABASE_JWT_SECRET!
    );

    return NextResponse.json({
      success: true,
      access_token: token,
      expires_in: 3600,
    });
  } catch (err: any) {
    console.error("❌ realtime-token:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
