/* eslint-disable @typescript-eslint/no-explicit-any */
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

  // --------------------------------------------------------
  // SESSION EXPIRED / NOT AUTHENTICATED
  // --------------------------------------------------------
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

  // --------------------------------------------------------
  // AUTO-OFFLINE PRESENCE TRACKING
  // --------------------------------------------------------
  useEffect(() => {
    if (!session?.user) return;

    const { accountId, username } = session.user;

    const markOffline = async () => {
      await fetch("/api/auth/update-status-offline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, username }),
      });
    };

    // 1️⃣ Browser/tab close
    window.addEventListener("beforeunload", markOffline);

    // 2️⃣ Session becomes unauthenticated (TS-safe comparison)
    if (["unauthenticated"].includes(status)) {
      markOffline();
    }

    // 3️⃣ Inactivity → auto offline after 10 minutes
    let inactivityTimer: any;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        markOffline();
      }, 10 * 60 * 1000); // 10 minutes
    };

    const events = ["mousemove", "keydown", "scroll", "click"];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    resetTimer(); // start timer

    return () => {
      window.removeEventListener("beforeunload", markOffline);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      clearTimeout(inactivityTimer);
    };
  }, [session, status]);

  // --------------------------------------------------------
  // LOADING
  // --------------------------------------------------------
  if (status === "loading") {
    console.log("Refreshing session silently...");
  }

  if (!session?.user) return null;

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
