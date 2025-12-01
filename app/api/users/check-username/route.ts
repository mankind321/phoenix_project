/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username")?.trim();

    if (!username) {
      return NextResponse.json({
        success: false,
        status: "invalid",
        message: "Username is required",
      });
    }

    // 🚫 BLOCK SPECIAL CHARACTERS
    // Allowed: A–Z, a–z, 0–9, underscore (_), dot (.)
    const validUsernameRegex = /^[A-Za-z0-9._]+$/;

    if (!validUsernameRegex.test(username)) {
      return NextResponse.json({
        success: false,
        status: "invalid",
        message:
          "Username contains invalid characters. Only letters, numbers, underscore (_), and dot (.) are allowed.",
      });
    }

    // 🔍 CHECK IF USERNAME EXISTS
    const { data, error } = await supabase
      .from("accounts")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      return NextResponse.json({
        success: true,
        status: "taken",
        message: "Username already taken",
        exists: true,
      });
    }

    return NextResponse.json({
      success: true,
      status: "available",
      message: "Username is available",
      exists: false,
    });

  } catch (err: any) {
    console.error("Username check error:", err.message);

    return NextResponse.json(
      {
        success: false,
        status: "error",
        message: err.message || "An error occurred",
        exists: false,
      },
      { status: 500 }
    );
  }
}
