/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

export function createRealtimeClient(accessToken: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    }
  );

  // 🔎 LOG JWT (sanity check)
  console.log("[realtime] JWT (first 30 chars):", accessToken.slice(0, 30));

  // 🔑 REQUIRED for Realtime RLS
  supabase.realtime.setAuth(accessToken);

  // ⚠️ INTERNAL SOCKET (cast required)
  const realtimeAny = supabase.realtime as any;

  realtimeAny.socket?.onOpen(() => {
    console.log("[realtime] socket OPEN");
  });

  realtimeAny.socket?.onClose((e: any) => {
    console.error("[realtime] socket CLOSED", e);
  });

  realtimeAny.socket?.onError((e: any) => {
    console.error("[realtime] socket ERROR", e);
  });

  return supabase;
}
