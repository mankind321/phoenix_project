/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, 
    {
      db: { schema: "api" },
      global: { headers },
    }
  );
}

export async function GET(req: Request) {
  try {
    // 1️⃣ Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ Get search params
    const { searchParams } = new URL(req.url);
    const property_id = searchParams.get("property_id");

    if (!property_id) {
      return NextResponse.json(
        { success: false, message: "property_id is required" },
        { status: 400 }
      );
    }

    // 3️⃣ RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    // 4️⃣ Supabase client
    const supabase = createRlsClient(rlsHeaders);

    // 5️⃣ Query lease table for active leases
    const { data, error } = await supabase
      .from("lease")
      .select("lease_id")
      .ilike("status", "active")
      .eq("property_id", property_id)
      .limit(1);

    if (error) throw error;

    const activeLease = Array.isArray(data) && data.length > 0;

    return NextResponse.json({
      success: true,
      activeLease,
    });
  } catch (err: any) {
    console.error("Lease Active API Error:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
