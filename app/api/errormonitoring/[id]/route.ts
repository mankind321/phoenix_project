/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditTrail } from "@/lib/auditLogger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function createRlsClient(headers: Record<string, string>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "public" },
      global: { headers },
    }
  );
}

/* ==========================================================
   🗑 DELETE — Error Monitoring Record (Next.js 14 FIX)
========================================================== */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> } // ✅ params is async
) {
  try {
    // ✅ MUST unwrap params
    const { id } = await params;

    // 1️⃣ Session check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    // 2️⃣ Delete
    const { error } = await supabase
      .from("document_registry")
      .delete()
      .eq("file_id", id);

    if (error) {
      console.error("Delete Error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // 3️⃣ Audit
    await logAuditTrail({
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      actionType: "DELETE",
      tableName: "document_registry",
      description: `Deleted error monitoring record (${id})`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "N/A",
      userAgent: req.headers.get("user-agent") ?? "Unknown",
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE Error:", err);
    return NextResponse.json(
      { error: err.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
