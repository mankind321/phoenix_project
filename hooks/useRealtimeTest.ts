/* eslint-disable @typescript-eslint/no-unused-vars */
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
  document_type: string | null;
};

export function useRealtimeTest(
  enabled: boolean,
  options?: {
    onExtractionSuccess?: () => void;
    onExtractionFailed?: () => void;
  },
) {
  const { data: session } = useSession();

  const subscribedRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef<any>(null);

  useEffect(() => {
    const userId = session?.user?.id;

    console.group("[realtime] useEffect");
    console.log("enabled:", enabled);
    console.log("userId:", userId);
    console.log("already subscribed:", subscribedRef.current);
    console.groupEnd();

    if (!enabled || !userId || subscribedRef.current) return;

    let cancelled = false;

    async function init() {
      console.group("[realtime] init");

      try {
        const res = await fetch("/api/realtime-token", { method: "POST" });
        const json = await res.json();

        if (!json.success) throw new Error("Realtime token failed");

        const supabase = createRealtimeClient(json.access_token);
        supabaseRef.current = supabase;

        const channel = supabase
          .channel(`document-extraction-alerts:${userId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "document_registry",
              filter: `user_id=eq.${userId}`,
            },
            (payload: RealtimePostgresInsertPayload<DocumentRegistryRow>) => {
              const row = payload.new;

              if (row.user_id !== userId) {
                console.warn("[realtime] user_id mismatch", {
                  expected: userId,
                  actual: row.user_id,
                });
                return;
              }

              const toastId = `doc-${row.user_id}-${row.file_name}-${row.extraction_status}`;

              if (row.extraction_status === "PASSED") {
                // normalize doc_type
                const normalizedDocType = row.document_type
                  ?.toLowerCase()
                  .replace(/_/g, " ")
                  .trim();

                const isRentRoll = normalizedDocType === "rent roll";

                const message = isRentRoll
                  ? `Data extraction for "${row.file_name ?? "document"}" has been successfully completed. See the Data in Tenant Page`
                  : `Data extraction for "${row.file_name ?? "document"}" has been successfully completed and forwarded to the Review page for evaluation.`;

                toast.success(message, {
                  id: toastId,
                  duration: 30_000,
                });

                options?.onExtractionSuccess?.();
              } else if (row.extraction_status === "FAILED") {
                toast.error(
                  `The extraction process for "${row.file_name ?? "document"}" was unsuccessful. Please refer to the Error Document List in the Document Management Tab to investigate and resolve the issue.`,
                  { id: toastId, duration: 30_000 },
                );

                options?.onExtractionFailed?.();
              }
            },
          )
          .subscribe((status, err) => {
            console.log("[realtime] channel status:", status);

            if (err) {
              console.error("[realtime] channel error:", err);
            }

            if (status === "SUBSCRIBED") {
              console.log("[realtime] subscribed successfully");
              subscribedRef.current = true;
            }

            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              console.error("[realtime] channel failed:", status);
              subscribedRef.current = false;
            }
          });

        channelRef.current = channel;
        console.log("[realtime] channel reference stored");
      } catch (err) {
        console.error("[realtime] init failed", err);
        subscribedRef.current = false;
      } finally {
        console.groupEnd();
      }
    }

    init();

    return () => {
      console.group("[realtime] cleanup");
      cancelled = true;

      subscribedRef.current = false;

      if (supabaseRef.current && channelRef.current) {
        console.log("[realtime] removing channel");
        supabaseRef.current.removeChannel(channelRef.current);
      } else {
        console.log("[realtime] no channel to remove");
      }

      channelRef.current = null;
      supabaseRef.current = null;
      console.groupEnd();
    };
  }, [enabled, options, session?.user?.id]);
}
