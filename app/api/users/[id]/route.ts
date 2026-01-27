/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Storage } from "@google-cloud/storage";
import bcrypt from "bcrypt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditTrail } from "@/lib/auditLogger";

// ============================================================
// 🔐 Supabase — SERVICE ROLE (Admin-only endpoint)
// ============================================================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// ☁️ Google Cloud Storage
// ============================================================
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!);

const storage = new Storage({
  projectId: credentials.project_id,
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
  },
});
const bucket = storage.bucket(process.env.GOOGLE_BUCKET_PROFILE!);

// ============================================================
// 📌 GET USER — ADMIN ONLY
// ============================================================
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "Admin") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { data: userData, error: userError } = await supabase
      .from("usersacc")
      .select(`
        userid, first_name, middle_name, last_name,
        date_of_birth, gender, email, mobile, address,
        license_number, license_issued_by, license_expiration,
        profile_image_url, createdby, updatedby, created_at, updated_at
      `)
      .eq("userid", id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const { data: accountData } = await supabase
      .from("account_view")
      .select("username, role, managerid, manager")
      .eq("user_id", id)
      .maybeSingle();

    const response = {
      ...userData,
      username: accountData?.username ?? "",
      role: accountData?.role ?? "",
      manager_id: accountData?.managerid ?? null,
      manager: accountData?.manager ?? "",
    };

    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "VIEW",
      tableName: "usersacc",
      recordId: id,
      description: `Admin viewed user: ${id}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown"
    });

    return NextResponse.json({ success: true, user: response });
  } catch (error: any) {
    console.error("❌ GET /api/users/[id]:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// ============================================================
// 📝 UPDATE USER — ADMIN ONLY
// ============================================================
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "Admin") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { formData, accountData } = await req.json();

    if (!formData || !accountData) {
      return NextResponse.json(
        { success: false, message: "Missing form or account data" },
        { status: 400 }
      );
    }

    if (accountData.role === "Agent" && !accountData.managerId) {
      return NextResponse.json(
        { success: false, message: "Agents must be assigned a manager." },
        { status: 400 }
      );
    }

    if (["Admin", "Manager"].includes(accountData.role) && accountData.managerId) {
      return NextResponse.json(
        { success: false, message: `${accountData.role}s cannot have a manager.` },
        { status: 400 }
      );
    }

    const { data: existingUser } = await supabase
      .from("usersacc")
      .select("profile_image_url, email")
      .eq("userid", id)
      .single();

    if (!existingUser) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    let newImageUrl = existingUser.profile_image_url;

    if (formData.profileImageUrl && formData.profileImageUrl !== existingUser.profile_image_url) {
      try {
        if (existingUser.profile_image_url?.includes("storage.googleapis.com")) {
          const oldFile = existingUser.profile_image_url.split("/").pop();
          if (oldFile) await bucket.file(`uploads/${oldFile}`).delete();
        }
      } catch {
        console.warn("⚠️ Failed to delete old profile image");
      }

      newImageUrl = formData.profileImageUrl;
    }

    let newPasswordHash = null;
    if (accountData.password?.trim()) {
      newPasswordHash = await bcrypt.hash(accountData.password, 10);
    }

    // ============================================================
    // 🏷️ UPDATE usersacc
    // ============================================================
    await supabase
      .from("usersacc")
      .update({
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
        profile_image_url: newImageUrl,
        updatedby: session.user.username,
        updated_at: new Date().toISOString()
      })
      .eq("userid", id);

    // ============================================================
    // 🔐 UPDATE accounts
    // ============================================================
    const accountUpdate: any = {
      username: accountData.username,
      role: accountData.role,
      manager_id: accountData.managerId || null,
      updated_at: new Date().toISOString()
    };

    if (newPasswordHash) {
      accountUpdate.password_hash = newPasswordHash;
    }

    await supabase.from("accounts").update(accountUpdate).eq("user_id", id);

    // ============================================================
    // 🔄 SYNC EMAIL TO SUPABASE AUTH (CRITICAL)
    // ============================================================
    const { data: account } = await supabase
      .from("accounts")
      .select("supabase_auth_user_id")
      .eq("user_id", id)
      .single();

    if (
      account?.supabase_auth_user_id &&
      formData.email &&
      formData.email !== existingUser.email
    ) {
      await supabase.auth.admin.updateUserById(
        account.supabase_auth_user_id,
        {
          email: formData.email,
          email_confirm: true
        }
      );
    }

    // ============================================================
    // 🔄 SYNC USERNAME TO accounts_status
    // ============================================================
    if (account?.supabase_auth_user_id) {
      await supabase
        .from("accounts_status")
        .update({ username: accountData.username })
        .eq("account_id", account.supabase_auth_user_id);
    }

    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "UPDATE",
      tableName: "usersacc",
      recordId: id,
      description: `Admin updated user ${accountData.username}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown"
    });

    return NextResponse.json({ success: true, message: "User updated successfully" });
  } catch (error: any) {
    console.error("❌ PUT /api/users/[id]:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// ============================================================
// 🗑 DELETE USER — ADMIN ONLY
// ============================================================
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "Admin") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("supabase_auth_user_id")
      .eq("user_id", id)
      .single();

    // ============================================================
    // 🔥 DELETE SUPABASE AUTH USER (CRITICAL)
    // ============================================================
    if (account?.supabase_auth_user_id) {
      await supabase.auth.admin.deleteUser(account.supabase_auth_user_id);
    }

    const { data: managedAgents } = await supabase
      .from("accounts")
      .select("accountid")
      .eq("manager_id", id);

    if ((managedAgents ?? []).length > 0) {
      return NextResponse.json(
        { success: false, message: "Cannot delete manager with assigned agents." },
        { status: 400 }
      );
    }

    const { data: existingUser } = await supabase
      .from("usersacc")
      .select("profile_image_url")
      .eq("userid", id)
      .single();

    if (existingUser?.profile_image_url?.includes("storage.googleapis.com")) {
      try {
        const file = existingUser.profile_image_url.split("/").pop();
        if (file) await bucket.file(`uploads/${file}`).delete();
      } catch {}
    }

    await supabase.from("accounts").delete().eq("user_id", id);
    await supabase.from("usersacc").delete().eq("userid", id);

    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "DELETE",
      tableName: "usersacc",
      recordId: id,
      description: `Admin deleted user ${id}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({
      success: true,
      message: "User and associated account deleted successfully",
    });
  } catch (error: any) {
    console.error("❌ DELETE /api/users/[id]:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
