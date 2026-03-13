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
      db: { schema: "public" },
      global: { headers },
    }
  );
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const rlsHeaders = {
      "x-app-role": session.user.role,
      "x-user-id": session.user.id,
      "x-account-id": session.user.accountId ?? "",
    };

    const supabase = createRlsClient(rlsHeaders);

    const { data, error, count } = await supabase
      .from("useraccountaccesslist")
      .select("*", { count: "exact" });

    if (error) {
      console.error("User count error:", error);

      return NextResponse.json(
        { error: "Failed to fetch user count" },
        { status: 500 }
      );
    }

    console.log("User count:", count);

    return NextResponse.json({
      total: count ?? data?.length ?? 0,
    });

  } catch (err: any) {
    console.error("User count API error:", err);

    return NextResponse.json(
      { error: err.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}