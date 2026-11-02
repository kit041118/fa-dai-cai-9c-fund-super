"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageIntro, Segmented, TextField } from "@/components/ui-bits";
import { useFund } from "@/components/fund-provider";
import { api } from "@/lib/api";
import type { FamilyBundle, Role } from "@/lib/types";

export function SetupView() {
  const fund = useFund();
  const router = useRouter();
  const [role, setRole] = useState<Role>("boyfriend");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"create" | "join" | null>(null);
  const [created, setCreated] = useState<FamilyBundle | null>(null);

  async function createFamily() {
    setPending("create");
    setError("");
    const result = await api<{ family: FamilyBundle }>("/api/family", {
      method: "POST",
      body: JSON.stringify({ role }),
    });
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCreated(result.data.family);
  }

  async function join() {
    setPending("join");
    setError("");
    const result = await api<{ family: FamilyBundle }>("/api/family/join", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("已加入家庭");
    await fund.refresh();
    router.replace("/");
  }

  async function enter() {
    await fund.refresh();
    router.replace("/");
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (created) {
    return (
      <div className="grid gap-4">
        <PageIntro title="家庭已建立" subtitle="把邀請碼交給伴侶。對方註冊後輸入即可加入。邀請碼也會留在設定裡。" />
        <div className="rounded-3xl bg-primary px-5 py-6 text-center text-primary-foreground">
          <p className="text-sm text-primary-foreground/75">邀請碼</p>
          <p className="mt-2 font-heading text-4xl tracking-[0.28em]">{created.inviteCode}</p>
        </div>
        <Button type="button" className="h-12 rounded-2xl" onClick={() => void enter()}>
          進入總覽
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <PageIntro
        eyebrow={fund.user?.displayName}
        title="建立或加入家庭"
        subtitle="一個人先建立基金，另一個人用邀請碼加入。也可以兩部手機登入同一個帳號。"
      />
      <section className="grid gap-3 rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="font-heading text-lg font-semibold">建立家庭基金</h2>
        <p className="text-sm leading-6 text-muted-foreground">你會成為第一位成員，並選擇自己在帳本上的角色。付款人仍可在每一筆另選。</p>
        <Segmented
          label="我是"
          value={role}
          onChange={setRole}
          options={[
            { value: "boyfriend", label: "男朋友" },
            { value: "girlfriend", label: "女朋友" },
          ]}
        />
        <Button type="button" className="h-12 rounded-2xl" disabled={pending !== null} onClick={() => void createFamily()}>
          {pending === "create" ? "建立中…" : "建立家庭基金"}
        </Button>
      </section>
      <section className="grid gap-3 rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="font-heading text-lg font-semibold">加入伴侶的家庭</h2>
        <TextField
          id="invite"
          label="6 位邀請碼"
          value={code}
          autoCapitalize="characters"
          autoCorrect="off"
          maxLength={6}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          className="tracking-[0.3em] uppercase"
        />
        <Button type="button" variant="outline" className="h-12 rounded-2xl bg-card" disabled={pending !== null} onClick={() => void join()}>
          {pending === "join" ? "加入中…" : "加入家庭"}
        </Button>
      </section>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => void logout()}>
        登出
      </button>
    </div>
  );
}
