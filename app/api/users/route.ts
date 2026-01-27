/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcrypt";
import { logAuditTrail } from "@/lib/auditLogger";

// ⚠️ ADMIN-ONLY SYSTEM OPERATIONS — MUST USE SERVICE ROLE KEY
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// GET — Fetch Users (Admin Only) with Pagination + Search
// ============================================================
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "Admin") {
    return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 10);
    const offset = (page - 1) * pageSize;
    const search = searchParams.get("search")?.trim() || "";

    let query = supabase
      .from("useraccountaccesslist")
      .select("*", { count: "exact" })
      .order("userid", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "VIEW",
      tableName: "usersacc",
      description: "Viewed user list",
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      data,
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}

// ============================================================
// POST — Create User + Account + Supabase Auth (Admin Only)
// ============================================================
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "Admin") {
    return NextResponse.json(
      { success: false, message: "Forbidden: Admins only" },
      { status: 403 }
    );
  }

  try {
    const { formData, accountData } = await req.json();

    if (!formData || !accountData) {
      return NextResponse.json(
        { success: false, message: "Invalid payload" },
        { status: 400 }
      );
    }

    // ============================================================
    // 1️⃣ Insert usersacc
    // ============================================================
    const { data: userInserted, error: userError } = await supabase
      .from("usersacc")
      .insert([
        {
          first_name: formData.firstName,
          middle_name: formData.middleName,
          last_name: formData.lastName,
          date_of_birth: formData.dateOfBirth,
          gender: formData.gender,
          email: formData.email,
          mobile: formData.mobile,
          address: formData.address,
          license_number: formData.licenseNumber,
          license_issued_by: formData.licenseIssuedBy,
          license_expiration: formData.licenseExpiration,
          profile_image_url: formData.profileImageUrl ?? null,
          createdby: session.user.username,
          updatedby: session.user.username,
        }
      ])
      .select("userid")
      .single();

    if (userError) throw userError;
    const userid = userInserted.userid;

    // ============================================================
    // 2️⃣ Hash password
    // ============================================================
    const hashedPassword = await bcrypt.hash(accountData.password, 10);

    // ============================================================
    // 3️⃣ Insert accounts
    // ============================================================
    const { data: accountInserted, error: accountError } = await supabase
      .from("accounts")
      .insert([
        {
          user_id: userid,
          username: accountData.username,
          password_hash: hashedPassword,
          role: accountData.role,
          manager_id: accountData.managerId || null,
        }
      ])
      .select("accountid")
      .single();

    if (accountError) throw accountError;

    // ============================================================
    // 4️⃣ CREATE SUPABASE AUTH USER (SHADOW IDENTITY)
    // ============================================================
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: formData.email,
        email_confirm: true,
        user_metadata: {
          accountid: accountInserted.accountid,
          username: accountData.username,
          role: accountData.role,
        }
      });

    if (authError) throw authError;

    // ============================================================
    // 5️⃣ LINK AUTH USER TO ACCOUNT
    // ============================================================
    await supabase
      .from("accounts")
      .update({
        supabase_auth_user_id: authUser.user.id
      })
      .eq("accountid", accountInserted.accountid);

    // ============================================================
    // 6️⃣ AUDIT LOG
    // ============================================================
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "CREATE",
      tableName: "usersacc",
      recordId: userid,
      description: `Created new ${accountData.role} (${accountData.username})`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown"
    });

    return NextResponse.json({
      success: true,
      message: "User created successfully",
      userid,
    });

  } catch (err: any) {
    console.error("❌ POST /api/users:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
