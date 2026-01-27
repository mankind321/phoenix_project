/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { createRealtimeClient } from "@/lib/supabaseRealtimeClient";
import type {
  RealtimePostgresInsertPayload,
  RealtimeChannel,
} from "@supabase/supabase-js";

type DocumentRegistryRow = {
  user_id: string | null;
  file_name: string | null;
  extraction_status: "PASSED" | "FAILED" | string;
};

export function useRealtimeTest(enabled: boolean) {
  const { data: session } = useSession();
  const subscribedRef = useRef(false);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!enabled || !userId || subscribedRef.current) return;

    subscribedRef.current = true;

    let channel: RealtimeChannel | null = null;
    let supabase: any;

    async function init() {
      const res = await fetch("/api/realtime-token", { method: "POST" });
      const json = await res.json();

      if (!json.success) {
        console.error("[realtime] token failed", json);
        return;
      }

      supabase = createRealtimeClient(json.access_token);

      channel = supabase
        .channel(`document-extraction-alerts:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "document_registry",
            // ✅ server-side filter (uploader only)
            filter: `user_id=eq.${userId}`,
          },
          (payload: RealtimePostgresInsertPayload<DocumentRegistryRow>) => {
            const row = payload.new;

            // 🔒 Absolute safety check
            if (row.user_id !== userId) return;

            // ✅ STABLE TOAST ID (prevents duplicates)
            const toastId = `doc-${row.user_id}-${row.file_name}-${row.extraction_status}`;

            if (row.extraction_status === "PASSED") {
              toast.success(
                `Data extraction for "${row.file_name ?? "document"}" has been successfully completed and forwarded to the Review page for evaluation.`,
                {
                  id: toastId,
                  duration: 15_000,
                }
              );
            } else if (row.extraction_status === "FAILED") {
              toast.error(
                `The extraction process for "${row.file_name ?? "document"}" was unsuccessful. Please refer to the Error Monitoring page to investigate and resolve the issue.`,
                {
                  id: toastId,
                  duration: 15_000,
                }
              );
            }
          }
        )
        .subscribe((status: RealtimeChannel["state"]) => {
          console.log("[realtime] status:", status);
        });
    }

    init();

    return () => {
      subscribedRef.current = false;
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [enabled, session?.user?.id]);
}
