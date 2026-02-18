/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ----------------------------------------------
// 🔐 Create Header-Based RLS Supabase Client
// ----------------------------------------------
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // required for header-based RLS
    {
      db: { schema: "api" },
      global: { headers },
    },
  );
}

/* ==========================================================
   📌 GET — Document TOTAL COUNT ONLY
========================================================== */
export async function GET() {
  try {
    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);
    const user = session?.user;

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2️⃣ Apply RLS headers
    const rlsHeaders = {
      "x-app-role": user.role,
      "x-user-id": user.id,
      "x-account-id": user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // 3️⃣ Count query only (no data returned)
    const { count, error } = await supabase.from("document_user").select("*", {
      count: "exact",
      head: true, // 🚀 only returns count
    });

    if (error) {
      console.error("Document count error:", error);

      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 500 },
      );
    }

    // 4️⃣ Return count
    return NextResponse.json({
      success: true,
      total: count ?? 0,
    });
  } catch (err: any) {
    console.error("Document count API error:", err);

    return NextResponse.json(
      {
        success: false,
        message: err.message || "Unexpected server error",
      },
      { status: 500 },
    );
  }
}
