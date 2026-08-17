"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Navigate regardless of the response. The cookie is cleared server-side,
      // and leaving someone stranded on a page they can no longer use because
      // the logout response was slow is worse than a redundant redirect.
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={busy}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-black/10 hover:bg-black/5 transition-colors disabled:opacity-50"
    >
      <LogOut size={13} />
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
