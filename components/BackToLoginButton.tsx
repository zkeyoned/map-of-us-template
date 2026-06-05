"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { writeAdminMode } from "@/data/adminMode";

export default function BackToLoginButton() {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  const backToLogin = async () => {
    if (working) return;
    setWorking(true);

    // Clear the session so the password page is shown again, then go back to it.
    await fetch("/api/auth/login", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "all" }),
    }).catch(() => {});
    writeAdminMode(false);

    router.push("/");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={backToLogin}
      disabled={working}
      aria-label="返回密码页"
      className="flex items-center gap-2 rounded-full border border-[#D8DDD8]/85 bg-[#FAFBF7]/82 px-4 py-2 text-sm font-semibold text-[#5A6670]/72 shadow-[0_10px_24px_rgba(90,102,112,0.08)] backdrop-blur transition hover:border-[#F5DCE0] hover:text-[#5A6670] disabled:opacity-50"
    >
      <Lock className="h-4 w-4 text-[#A8C8DC]" />
      返回密码页
    </button>
  );
}
