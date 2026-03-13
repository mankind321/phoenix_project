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
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("property_id");

    if (!propertyId) {
      return NextResponse.json(
        { error: "property_id is required" },
        { status: 400 }
      );
    }

    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    /* EXPIRED COUNT */

    const { count: expiredCount, error: expiredError } = await supabase
      .from("lease")
      .select("lease_id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .ilike("status", "expired");

    if (expiredError) throw expiredError;

    /* ACTIVE COUNT */

    const { count: activeCount, error: activeError } = await supabase
      .from("lease")
      .select("lease_id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .not("status", "ilike", "expired");

    if (activeError) throw activeError;

    return NextResponse.json({
      success: true,
      data: {
        active: activeCount ?? 0,
        expired: expiredCount ?? 0,
      },
    });

  } catch (err: any) {
    console.error("Lease count-status API error:", err);

    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}