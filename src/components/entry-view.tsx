"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageIntro, Segmented, SelectField, TextField } from "@/components/ui-bits";
import { useFund } from "@/components/fund-provider";
import { hkToday, parseHkdToCents } from "@/lib/format";
import type { ExpenseUpsert, Role, Scope } from "@/lib/types";

export function EntryView({ expenseId }: { expenseId?: string }) {
  const router = useRouter();
  const fund = useFund();
  const existing = expenseId ? fund.expenses.find((expense) => expense.id === expenseId) : undefined;
  const idRef = useRef(existing?.id ?? expenseId ?? crypto.randomUUID());
  const family = fund.family;

  const [amount, setAmount] = useState(() => (existing ? (existing.amountCents / 100).toFixed(2).replace(/\.00$/, "") : ""));
  const [payer, setPayer] = useState<Role>(existing?.payer ?? fund.user?.role ?? "boyfriend");
  const [methodId, setMethodId] = useState(existing?.paymentMethodId ?? family?.paymentMethods[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? family?.categories[0]?.id ?? "");
  const [spentOn, setSpentOn] = useState(existing?.spentOn ?? hkToday());
  const [note, setNote] = useState(existing?.note ?? "");
  const [scope, setScope] = useState<Scope>(existing?.scope ?? "shared");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const missing = Boolean(expenseId && family && !existing);
  const title = existing ? "編輯支出" : "記一筆";

  const payerOptions = useMemo(() => {
    if (!family) return [];
    return [
      { value: "boyfriend" as const, label: family.boyfriendName },
      { value: "girlfriend" as const, label: family.girlfriendName },
    ];
  }, [family]);

  if (!family) return null;
  if (missing) {
    return (
      <div className="rounded-3xl bg-card p-6 ring-1 ring-foreground/10">
        <h1 className="font-heading text-xl">找不到這筆支出</h1>
        <p className="mt-2 text-sm text-muted-foreground">它可能已被刪除，或尚未同步到此裝置。</p>
        <Button type="button" className="mt-4 h-12 rounded-2xl" onClick={() => router.push("/ledger")}>
          返回紀錄
        </Button>
      </div>
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!family) return;
    const nextErrors: Record<string, string> = {};
    const parsed = parseHkdToCents(amount);
    if (!parsed.ok) nextErrors.amount = parsed.error;
    if (!methodId) nextErrors.paymentMethodId = "請選擇支付類型";
    if (!categoryId) nextErrors.categoryId = "請選擇消費類型";
    if (!spentOn) nextErrors.spentOn = "請選擇日期";
    if (note.trim().length > 200) nextErrors.note = "備註最多 200 字";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !parsed.ok) return;

    const expense: ExpenseUpsert = {
      id: idRef.current,
      amountCents: parsed.cents,
      payer,
      paymentMethodId: methodId,
      categoryId,
      spentOn,
      note: note.trim(),
      scope,
    };
    setSaving(true);
    const result = await fund.saveExpense(expense);
    setSaving(false);
    if (!result.ok) {
      setErrors(result.fields ?? {});
      toast.error(result.error);
      return;
    }
    toast.success(result.pending ? "已暫存在此裝置，連線後會自動同步" : existing ? "已更新支出" : "已記好一筆");
    router.push("/ledger");
  }

  function cancel() {
    if (window.history.length > 1) router.back();
    else router.push("/ledger");
  }

  return (
    <form className="grid gap-4" onSubmit={save} noValidate>
      <PageIntro
        title={title}
        subtitle={fund.syncPhase === "pending" ? "目前有紀錄尚未同步。新的一筆若送不出去，會先存在這部手機。" : "金額以港幣計算，可選共同或個人。"}
      />
      <TextField
        id="amount"
        label="金額（港幣）"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        error={errors.amount}
        className="h-16 pl-4 text-right font-heading text-3xl"
      />
      <Segmented label="付款人" value={payer} onChange={setPayer} options={payerOptions} />
      <SelectField id="method" label="支付類型" value={methodId} onChange={setMethodId} error={errors.paymentMethodId}>
        {family.paymentMethods.map((method) => (
          <option key={method.id} value={method.id}>
            {method.name}
          </option>
        ))}
      </SelectField>
      <SelectField id="category" label="消費類型" value={categoryId} onChange={setCategoryId} error={errors.categoryId}>
        {family.categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </SelectField>
      <TextField
        id="spentOn"
        label="日期"
        type="date"
        value={spentOn}
        min="2000-01-01"
        max="2100-12-31"
        onChange={(event) => setSpentOn(event.target.value)}
        error={errors.spentOn}
      />
      <div className="grid gap-1.5">
        <label htmlFor="note" className="text-sm font-medium">
          備註
        </label>
        <Textarea
          id="note"
          value={note}
          maxLength={200}
          placeholder="例如：茶餐廳早餐"
          onChange={(event) => setNote(event.target.value)}
          className="min-h-24 rounded-2xl bg-card px-3.5 py-3 text-base md:text-base"
          aria-invalid={errors.note ? true : undefined}
        />
        {errors.note ? <p className="text-sm text-destructive">{errors.note}</p> : null}
      </div>
      <Segmented
        label="支出歸屬"
        value={scope}
        onChange={setScope}
        options={[
          { value: "shared", label: "共同" },
          { value: "personal", label: "個人" },
        ]}
      />
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button type="button" variant="outline" className="h-12 rounded-2xl bg-card" onClick={cancel}>
          取消
        </Button>
        <Button type="submit" className="h-12 rounded-2xl" disabled={saving}>
          {saving ? "儲存中…" : "儲存"}
        </Button>
      </div>
    </form>
  );
}
