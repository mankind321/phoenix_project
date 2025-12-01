import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { accountId, username } = await req.json();

    if (!accountId || !username) {
      return NextResponse.json(
        { success: false, message: "Missing accountId or username" },
        { status: 400 }
      );
    }

    // Update status to offline
    await supabase
      .from("accounts_status")
      .update({ account_status: "offline" })
      .eq("account_id", accountId)
      .eq("username", username);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error updating status:", err);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
