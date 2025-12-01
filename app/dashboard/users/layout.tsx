"use client";

import { ReactNode, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { TopHeader } from "@/app/components/header";
import { TopHeaderAdmin } from "@/app/components/headerAdmin";
import { TopHeaderManager } from "@/app/components/headerManager";
import { AutoLogout } from "@/app/components/autologout";

interface AuditTrailLayoutProps {
  children: ReactNode;
}

export default function AuditTrailLayout({ children }: AuditTrailLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // ----------------------------------------------------------
  // SESSION EXPIRED HANDLING
  // ----------------------------------------------------------
  useEffect(() => {
    const isLoggingOut =
      typeof window !== "undefined" &&
      sessionStorage.getItem("isLoggingOut") === "true";

    if (status === "unauthenticated") {
      if (!isLoggingOut) {
        toast.error("Session expired or not logged in.");
      } else {
        sessionStorage.removeItem("isLoggingOut");
      }
      router.replace("/login");
    }
  }, [status, router]);

  // ----------------------------------------------------------
  // AUTO-OFFLINE PRESENCE TRACKING
  // ----------------------------------------------------------
  useEffect(() => {
    if (!session?.user) return;

    const { accountId, username } = session.user;

    const markOffline = async () => {
      try {
        await fetch("/api/auth/update-status-offline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, username }),
        });
      } catch (err) {
        console.warn("⚠ Failed to update offline status:", err);
      }
    };

    // 1️⃣ If session becomes unauthenticated → mark offline
    if (["unauthenticated"].includes(status)) {
      markOffline();
    }

    // 2️⃣ Browser/tab close → mark offline
    window.addEventListener("beforeunload", markOffline);

    // 3️⃣ Auto-offline after 10 minutes inactivity
    let inactivityTimer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        markOffline();
      }, 10 * 60 * 1000); // 10 minutes
    };

    const events = ["mousemove", "keydown", "scroll", "click"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));
    resetTimer();

    return () => {
      window.removeEventListener("beforeunload", markOffline);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      clearTimeout(inactivityTimer);
    };
  }, [session, status]);

  // ----------------------------------------------------------
  // LOADING STATE
  // ----------------------------------------------------------
  if (status === "loading") {
    console.log("Refreshing session silently...");
  }

  if (!session?.user) return null;

  // ----------------------------------------------------------
  // RENDER LAYOUT
  // ----------------------------------------------------------
  return (
    <div className="min-h-screen bg-white">
      <AutoLogout />

      {/* FIXED SIDEBAR */}
      <div className="sidebar-scroll w-64 h-screen fixed left-0 top-0 border-r border-gray-200 bg-white">
        {session.user.role === "Admin" ? (
          <TopHeaderAdmin />
        ) : session.user.role === "Manager" ? (
          <TopHeaderManager />
        ) : (
          <TopHeader />
        )}
      </div>

      {/* MAIN CONTENT */}
      <main className="ml-64 p-6 bg-white">{children}</main>
    </div>
  );
}
