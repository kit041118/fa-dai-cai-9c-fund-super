"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { Donut } from "@/components/donut";
import { EmptyState, Money } from "@/components/ui-bits";
import { useFund } from "@/components/fund-provider";
import { SCOPE_LABEL } from "@/lib/constants";
import { formatHkd, formatLongDate, hkMonthKey, monthLabel, payerName } from "@/lib/format";

export function OverviewView() {
  const { family, expenses } = useFund();
  if (!family) return null;
  const month = hkMonthKey();
  const rows = expenses.filter((expense) => expense.spentOn.startsWith(month));
  const total = rows.reduce((sum, expense) => sum + expense.amountCents, 0);
  const shared = rows.filter((expense) => expense.scope === "shared").reduce((sum, expense) => sum + expense.amountCents, 0);
  const boyfriend = rows.filter((expense) => expense.payer === "boyfriend").reduce((sum, expense) => sum + expense.amountCents, 0);
  const girlfriend = rows.filter((expense) => expense.payer === "girlfriend").reduce((sum, expense) => sum + expense.amountCents, 0);
  const goal = family.monthlyGoalCents;
  const progress = goal > 0 ? Math.min(100, Math.round((shared / goal) * 100)) : 0;
  const maxSide = Math.max(boyfriend, girlfriend, 1);
  const byCategory = new Map<string, { id: string; label: string; value: number }>();
  for (const expense of rows) {
    const current = byCategory.get(expense.categoryId) ?? {
      id: expense.categoryId,
      label: expense.categoryName,
      value: 0,
    };
    current.value += expense.amountCents;
    byCategory.set(expense.categoryId, current);
  }
  const slices = [...byCategory.values()].sort((a, b) => b.value - a.value);

  return (
    <div className="grid gap-4">
      <section className="rounded-3xl bg-primary px-5 py-6 text-primary-foreground">
        <p className="text-sm text-primary-foreground/75">{monthLabel(month)}總支出</p>
        <p className="mt-2 font-heading text-4xl tracking-tight tabular-nums">{formatHkd(total)}</p>
        <p className="mt-2 text-sm text-primary-foreground/75">雙方合計 · {rows.length} 筆</p>
      </section>

      <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">共同目標</h2>
          {goal > 0 ? <span className="text-sm tabular-nums text-muted-foreground">{progress}%</span> : null}
        </div>
        {goal > 0 ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              共同支出 <Money cents={shared} /> / {formatHkd(goal)}
            </p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
              <div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {shared >= goal ? `已達成，超出 ${formatHkd(shared - goal)}。` : "只計算標記為共同的支出。"}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            每月共同目標已關閉。可在設定輸入金額，0 表示維持關閉。
          </p>
        )}
      </section>

      {rows.length === 0 ? (
        <EmptyState
          title="這個月還沒有紀錄"
          body="記下一筆早餐、車費或超市，總覽就會開始累積。"
          action={
            <Link href="/entry" className={cn(buttonVariants(), "h-12 rounded-2xl px-6")}>
              記一筆
            </Link>
          }
        />
      ) : (
        <>
          <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="font-heading text-lg font-semibold">雙方支出對比</h2>
            <p className="mt-1 text-xs text-muted-foreground">包含個人與共同</p>
            <div className="mt-4 grid gap-4">
              <Bar label={family.boyfriendName} cents={boyfriend} width={(boyfriend / maxSide) * 100} />
              <Bar label={family.girlfriendName} cents={girlfriend} width={(girlfriend / maxSide) * 100} />
            </div>
          </section>
          <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="mb-4 font-heading text-lg font-semibold">類別分佈</h2>
            <Donut slices={slices} center={formatHkd(total)} />
          </section>
          <section>
            <h2 className="mb-3 font-heading text-lg font-semibold">本月最近紀錄</h2>
            <ul className="grid gap-2">
              {rows.slice(0, 4).map((expense) => (
                <li key={expense.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{expense.note || expense.categoryName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatLongDate(expense.spentOn)} · {payerName(expense.payer, family)} · {SCOPE_LABEL[expense.scope]}
                      {expense.pending ? " · 離線暫存" : ""}
                    </p>
                  </div>
                  <Money cents={expense.amountCents} className="font-medium" />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <Link href="/report" className={cn(buttonVariants({ variant: "outline" }), "h-12 rounded-2xl bg-card")}>
        查看報告
      </Link>
    </div>
  );
}

function Bar({ label, cents, width }: { label: string; cents: number; width: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <Money cents={cents} />
      </div>
      <div className="h-2.5 rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(width, cents > 0 ? 4 : 0)}%` }} />
      </div>
    </div>
  );
}
