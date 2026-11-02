"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { PageIntro, TextField } from "@/components/ui-bits";
import { useFund } from "@/components/fund-provider";
import { api } from "@/lib/api";
import { formatHkd } from "@/lib/format";
import { clearLocalFund } from "@/lib/sync";

export function SettingsView() {
  const router = useRouter();
  const fund = useFund();
  const family = fund.family;
  const [boyfriendName, setBoyfriendName] = useState(family?.boyfriendName ?? "男朋友");
  const [girlfriendName, setGirlfriendName] = useState(family?.girlfriendName ?? "女朋友");
  const [goal, setGoal] = useState(family ? String(family.monthlyGoalCents / 100) : "0");
  const [categoryName, setCategoryName] = useState("");
  const [methodName, setMethodName] = useState("");
  const [wishTitle, setWishTitle] = useState("");
  const [wishBudget, setWishBudget] = useState("");
  const [saving, setSaving] = useState(false);

  if (!family || !fund.user) return null;

  function online() {
    if (!navigator.onLine) {
      toast.error("請先連線再變更設定");
      return false;
    }
    return true;
  }

  async function saveProfile() {
    if (!online()) return;
    setSaving(true);
    const result = await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ boyfriendName, girlfriendName, monthlyGoal: goal }),
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("已更新設定");
    await fund.refresh();
  }

  async function addNamed(path: string, name: string, clear: () => void) {
    if (!online()) return;
    const result = await api(path, { method: "POST", body: JSON.stringify({ name }) });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    clear();
    toast.success("已新增");
    await fund.refresh();
  }

  async function removeNamed(path: string) {
    if (!online()) return;
    const result = await api(path, { method: "DELETE" });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    await fund.refresh();
  }

  async function addWish() {
    if (!online()) return;
    const result = await api("/api/wishes", {
      method: "POST",
      body: JSON.stringify({ title: wishTitle, budget: wishBudget }),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setWishTitle("");
    setWishBudget("");
    toast.success("已加入願望");
    await fund.refresh();
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(family?.inviteCode ?? "");
      toast.success("已複製邀請碼");
    } catch {
      toast.message("請長按邀請碼手動複製");
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    clearLocalFund();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <PageIntro title="設定" subtitle="邀請碼、顯示名稱、目標、類型與匯出都在這裡。" />

      <section className="rounded-3xl bg-primary px-5 py-5 text-primary-foreground">
        <p className="text-sm text-primary-foreground/75">家庭邀請碼</p>
        <p className="mt-2 font-heading text-4xl tracking-[0.28em]">{family.inviteCode}</p>
        <p className="mt-2 text-sm leading-6 text-primary-foreground/80">
          伴侶註冊自己的帳號後輸入這 6 位碼，就會看到同一本帳。兩部手機登入同一個帳號也可以。
        </p>
        <Button type="button" variant="secondary" className="mt-4 h-11 rounded-2xl" onClick={() => void copyCode()}>
          複製邀請碼
        </Button>
      </section>

      <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="font-heading text-lg font-semibold">家庭成員</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {family.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3">
              <span>
                {member.displayName}
                <span className="mt-0.5 block text-xs text-muted-foreground">{member.email}</span>
              </span>
              <span className="text-muted-foreground">
                {member.role === "boyfriend" ? family.boyfriendName : member.role === "girlfriend" ? family.girlfriendName : "未指定"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="font-heading text-lg font-semibold">稱呼與共同目標</h2>
        <TextField id="bf-name" label="男朋友顯示名稱" value={boyfriendName} onChange={(event) => setBoyfriendName(event.target.value)} />
        <TextField id="gf-name" label="女朋友顯示名稱" value={girlfriendName} onChange={(event) => setGirlfriendName(event.target.value)} />
        <TextField
          id="goal"
          label="每月共同目標（港幣）"
          inputMode="decimal"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          hint="設為 0 即關閉目標。只計算共同支出。"
        />
        <Button type="button" className="h-12 rounded-2xl" disabled={saving} onClick={() => void saveProfile()}>
          {saving ? "儲存中…" : "儲存"}
        </Button>
      </section>

      <NameList
        title="消費類型"
        items={family.categories.map((item) => ({ id: item.id, name: item.name }))}
        value={categoryName}
        onChange={setCategoryName}
        onAdd={() => void addNamed("/api/categories", categoryName, () => setCategoryName(""))}
        onRemove={(id) => void removeNamed(`/api/categories/${id}`)}
        placeholder="例如：寵物"
      />
      <NameList
        title="支付類型"
        items={family.paymentMethods.map((item) => ({ id: item.id, name: item.name }))}
        value={methodName}
        onChange={setMethodName}
        onAdd={() => void addNamed("/api/payment-methods", methodName, () => setMethodName(""))}
        onRemove={(id) => void removeNamed(`/api/payment-methods/${id}`)}
        placeholder="例如：PayMe、轉數快"
      />

      <section className="grid gap-3 rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="font-heading text-lg font-semibold">共同願望</h2>
        <ul className="grid gap-2">
          {family.wishes.length === 0 ? <li className="text-sm text-muted-foreground">還沒有願望。</li> : null}
          {family.wishes.map((wish) => (
            <li key={wish.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {wish.title}
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {wish.budgetCents == null ? "未設預算" : `預算 ${formatHkd(wish.budgetCents)}`}
                </span>
              </span>
              <button type="button" className="text-destructive" onClick={() => void removeNamed(`/api/wishes/${wish.id}`)}>
                移除
              </button>
            </li>
          ))}
        </ul>
        <TextField id="wish-title" label="願望" value={wishTitle} onChange={(event) => setWishTitle(event.target.value)} />
        <TextField id="wish-budget" label="預算（可留空）" inputMode="decimal" value={wishBudget} onChange={(event) => setWishBudget(event.target.value)} />
        <Button type="button" variant="outline" className="h-11 rounded-2xl bg-card" onClick={() => void addWish()}>
          加入願望
        </Button>
      </section>

      <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="font-heading text-lg font-semibold">匯出</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          CSV 以 UTF-8 並附 BOM，Excel 可直接開啟中文。金額欄是數字。
        </p>
        <a
          href="/api/export"
          className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-12 w-full rounded-2xl bg-card")}
          onClick={(event) => {
            if (!navigator.onLine) {
              event.preventDefault();
              toast.error("離線時無法匯出，請連線後再試");
            }
          }}
        >
          匯出全部支出（CSV）
        </a>
      </section>

      <Button type="button" variant="outline" className="h-12 rounded-2xl" onClick={() => void logout()}>
        登出
      </Button>
      <p className="text-center text-xs text-muted-foreground">目前登入：{fund.user.email}</p>
    </div>
  );
}

function NameList({
  title,
  items,
  value,
  onChange,
  onAdd,
  onRemove,
  placeholder,
}: {
  title: string;
  items: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  placeholder: string;
}) {
  return (
    <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="rounded-full bg-secondary px-3 py-1.5 text-sm"
              onClick={() => onRemove(item.id)}
              aria-label={`刪除${item.name}`}
            >
              {item.name}
              <span className="ml-1 text-muted-foreground" aria-hidden>
                ×
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={`新增${title}`}
          className="h-11 min-w-0 flex-1 rounded-2xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        />
        <Button type="button" className="h-11 rounded-2xl px-4" onClick={onAdd}>
          新增
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">點一下名稱即可刪除。已被支出使用的項目無法刪除。</p>
    </section>
  );
}
