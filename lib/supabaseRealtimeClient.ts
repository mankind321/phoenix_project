import { createClient } from "@supabase/supabase-js";

export function createRealtimeClient(accessToken: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    }
  );

  // ✅ THIS is the missing step
  supabase.realtime.setAuth(accessToken);

  return supabase;
}
