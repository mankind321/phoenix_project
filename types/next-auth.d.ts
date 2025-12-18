import "next-auth";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    session_id?: string; // ✅ added here
    user: {
      id: string;
      username: string;
      role: string;
      firstName: string;
      middleName: string;
      lastName: string;
      licenseNumber: string;
      profileImageUrl?: string;
      accountId: string;
      managerId?: string;
      supabaseAccessToken?: string;
      session_id?: string; // 🔥 expose inside session.user too
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username: string;
    role: string;
    firstName: string;
    middleName: string;
    lastName: string;
    licenseNumber: string;
    profileImageUrl?: string;
    accountId: string;
    managerId?: string;
    session_id?: string; // 🔥 attach to user object returned from authorize()
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user: {
      id: string;
      username: string;
      role: string;
      firstName: string;
      middleName: string;
      lastName: string;
      licenseNumber: string;
      profileImageUrl?: string;
      accountId: string;
      managerId?: string;
      session_id?: string; // 🔥 stored in token.user
    };
    session_id?: string; // 🔥 stored at top-level in JWT
    supabaseAccessToken?: string;
  }
}
