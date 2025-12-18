/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";

// Service-role client (audit logs require full permissions)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "api" } }
);

export async function POST(req: Request) {
  try {
    // 1️⃣ Validate authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { property_id, status } = body;

    if (!property_id || !status) {
      return NextResponse.json(
        { success: false, message: "property_id and status are required" },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const username = session.user.username ?? "system";

    // 2️⃣ Update property status
    const { data, error } = await supabase
      .from("property")
      .update({
        status,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("property_id", property_id)
      .select("property_id, status")
      .limit(1);

    if (error) {
      console.error("❌ Supabase Update Error:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, message: "Property not found" },
        { status: 404 }
      );
    }

    // 3️⃣ Audit log entry
    await logAuditTrail({
      userId: session.user.id,
      username,
      role: session.user.role,
      actionType: "UPDATE",
      tableName: "property",
      recordId: String(property_id),
      description: `Updated property status to '${status}'`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      message: "Property status updated successfully",
    });
  } catch (err: any) {
    console.error("❌ POST /api/properties/update-status:", err.message);

    return NextResponse.json(
      { success: false, message: "Server error: " + err.message },
      { status: 500 }
    );
  }
}
