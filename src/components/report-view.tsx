"use client";

import { useMemo, useState } from "react";
import { Donut } from "@/components/donut";
import { EmptyState, Money, PageIntro, Segmented } from "@/components/ui-bits";
import { useFund } from "@/components/fund-provider";
import { SCOPE_LABEL } from "@/lib/constants";
import { formatLongDate, hkMonthKey, monthBounds, payerName, previousMonthKey } from "@/lib/format";
import type { Role, Scope } from "@/lib/types";

type Range = "month" | "previous" | "custom";
type ScopeFilter = "all" | Scope;

export function ReportView() {
  const { family, expenses } = useFund();
  const [payer, setPayer] = useState<Role>("boyfriend");
  const [range, setRange] = useState<Range>("month");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [from, setFrom] = useState(monthBounds(hkMonthKey()).start);
  const [to, setTo] = useState(monthBounds(hkMonthKey()).end);
  const [rangeError, setRangeError] = useState("");

  const bounds = useMemo(() => {
    if (range === "month") return monthBounds(hkMonthKey());
    if (range === "previous") return monthBounds(previousMonthKey(hkMonthKey()));
    return { start: from, end: to };
  }, [range, from, to]);

  if (!family) return null;

  const personRows = expenses.filter((expense) => {
    if (expense.payer !== payer) return false;
    if (expense.spentOn < bounds.start || expense.spentOn > bounds.end) return false;
    return true;
  });
  const sharedTotal = personRows.filter((expense) => expense.scope === "shared").reduce((sum, expense) => sum + expense.amountCents, 0);
  const personalTotal = personRows.filter((expense) => expense.scope === "personal").reduce((sum, expense) => sum + expense.amountCents, 0);
  const rows = personRows.filter((expense) => (scope === "all" ? true : expense.scope === scope));
  const total = rows.reduce((sum, expense) => sum + expense.amountCents, 0);

  const paymentSlices = group(rows, (expense) => expense.paymentMethodId, (expense) => expense.paymentMethodName);
  const categorySlices = group(rows, (expense) => expense.categoryId, (expense) => expense.categoryName);

  function changeCustom(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (nextFrom && nextTo && nextFrom > nextTo) setRangeError("開始日期不能晚於結束日期");
    else setRangeError("");
  }

  return (
    <div className="grid gap-4">
      <PageIntro title="報告" subtitle="選擇一位家人、時間範圍，以及要看共同還是個人。" />
      <Segmented
        label="對象"
        value={payer}
        onChange={setPayer}
        options={[
          { value: "boyfriend", label: family.boyfriendName },
          { value: "girlfriend", label: family.girlfriendName },
        ]}
      />
      <Segmented
        label="範圍"
        value={range}
        onChange={setRange}
        options={[
          { value: "month", label: "本月" },
          { value: "previous", label: "上月" },
          { value: "custom", label: "自訂" },
        ]}
      />
      {range === "custom" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-sm">
            由
            <input type="date" value={from} onChange={(event) => changeCustom(event.target.value, to)} className="h-11 rounded-2xl border border-input bg-card px-3" />
          </label>
          <label className="grid gap-1 text-sm">
            至
            <input type="date" value={to} onChange={(event) => changeCustom(from, event.target.value)} className="h-11 rounded-2xl border border-input bg-card px-3" />
          </label>
          {rangeError ? <p className="col-span-2 text-sm text-destructive">{rangeError}</p> : null}
        </div>
      ) : null}
      <Segmented
        label="歸屬"
        value={scope}
        onChange={setScope}
        options={[
          { value: "all", label: "全部" },
          { value: "shared", label: "共同" },
          { value: "personal", label: "個人" },
        ]}
      />

      <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
        <p className="text-sm text-muted-foreground">{payerName(payer, family)} 這段期間</p>
        <p className="mt-1 font-heading text-3xl tabular-nums">{rangeError ? "—" : formatQuiet(total)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-gold-soft px-3 py-3">
            <p className="text-xs">共同</p>
            <p className="mt-1 font-medium tabular-nums"><Money cents={sharedTotal} /></p>
          </div>
          <div className="rounded-2xl bg-sage px-3 py-3">
            <p className="text-xs text-sage-ink">個人</p>
            <p className="mt-1 font-medium tabular-nums text-sage-ink"><Money cents={personalTotal} /></p>
          </div>
        </div>
      </section>

      {rangeError || rows.length === 0 ? (
        <EmptyState title="這段期間沒有支出" body="換一個月份、範圍，或先記一筆再回來查看。" />
      ) : (
        <>
          <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="mb-4 font-heading text-lg font-semibold">支付類型</h2>
            <Donut slices={paymentSlices} center={formatQuiet(total)} />
          </section>
          <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="mb-4 font-heading text-lg font-semibold">消費類型</h2>
            <Donut slices={categorySlices} center={formatQuiet(total)} />
          </section>
          <section>
            <h2 className="mb-3 font-heading text-lg font-semibold">明細</h2>
            <ul className="grid gap-2">
              {rows.map((expense) => (
                <li key={expense.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{expense.note || expense.categoryName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatLongDate(expense.spentOn)} · {expense.categoryName} · {expense.paymentMethodName} · {SCOPE_LABEL[expense.scope]}
                    </p>
                  </div>
                  <Money cents={expense.amountCents} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function formatQuiet(cents: number) {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const fraction = abs % 100;
  const body = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}HK$${body}${fraction ? `.${String(fraction).padStart(2, "0")}` : ""}`;
}

function group<T extends { amountCents: number }>(
  rows: T[],
  idOf: (row: T) => string,
  labelOf: (row: T) => string,
) {
  const map = new Map<string, { id: string; label: string; value: number }>();
  for (const row of rows) {
    const id = idOf(row);
    const current = map.get(id) ?? { id, label: labelOf(row), value: 0 };
    current.value += row.amountCents;
    map.set(id, current);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}
