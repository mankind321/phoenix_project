/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";

// ----------------------------------------------
// 🔐 RLS-enabled Supabase Client (Header-Based)
// ----------------------------------------------
function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role required for header-based RLS
    {
      db: { schema: "api" },
      global: { headers },
    },
  );
}

function toUsdString(value: any): string | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return `$${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ======================================================
// GET — View Lease (UNCHANGED LOGIC)
// ======================================================
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leaseId } = await params;

    if (!leaseId) {
      return NextResponse.json(
        { success: false, message: "Lease ID is required" },
        { status: 400 },
      );
    }

    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2️⃣ RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // 3️⃣ Lease data (VIEW)
    const { data: lease, error: leaseError } = await supabase
      .from("view_lease_property_with_user")
      .select("*")
      .eq("lease_id", leaseId)
      .single();

    if (leaseError) throw leaseError;

    // 4️⃣ Contacts
    const { data: contacts, error: contactError } = await supabase
      .from("contact_with_assignment")
      .select("*")
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: false });

    if (contactError) throw contactError;

    // 5️⃣ Audit
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "READ",
      tableName: "lease",
      description: `Viewed lease for tenant: ${lease.tenant}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      data: {
        lease,
        contacts,
      },
    });
  } catch (err: any) {
    console.error("GET /lease/[id] Error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error" },
      { status: 500 },
    );
  }
}

// ======================================================
// PUT — Update Lease (NEW, BASED ON api.lease TABLE)
// ======================================================
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leaseId } = await params;

    if (!leaseId) {
      return NextResponse.json(
        { success: false, message: "Lease ID is required" },
        { status: 400 },
      );
    }

    // 1️⃣ Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();

    // 2️⃣ RLS headers
    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // 3️⃣ Update payload (STRICTLY api.lease columns)
    const payload: Record<string, any> = {
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
      user_id: session.user.id,
    };

    const assignIfPresent = (key: string, value: any) => {
      if (key in body) {
        payload[key] = value === "" ? null : (value ?? null);
      }
    };

    assignIfPresent("tenant", body.tenant);
    assignIfPresent("landlord", body.landlord);
    assignIfPresent("property_id", body.property_id);
    assignIfPresent("lease_start", body.lease_start);
    assignIfPresent("lease_end", body.lease_end);
    assignIfPresent("availability_date", body.availability_date);
    assignIfPresent("annual_rent", body.annual_rent);
    assignIfPresent("rent_psf", body.rent_psf);
    assignIfPresent("price", body.price);
    assignIfPresent("noi", body.noi);
    assignIfPresent("pass_tmru", body.pass_tmru);
    assignIfPresent("status", body.status);
    assignIfPresent("comments", body.comments);

    // USD fields
    if ("price" in body) {
      payload.price_usd = toUsdString(body.price);
    }
    if ("annual_rent" in body) {
      payload.annual_rent_usd = toUsdString(body.annual_rent);
    }

    // 4️⃣ Update lease
    const { data, error } = await supabase
      .from("lease")
      .update(payload)
      .eq("lease_id", leaseId)
      .select()
      .single();

    if (error) throw error;

    // 5️⃣ Audit
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "UPDATE",
      tableName: "lease",
      description: `Updated lease for tenant: ${data.tenant}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err: any) {
    console.error("PUT /lease/[id] Error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error" },
      { status: 500 },
    );
  }
}
