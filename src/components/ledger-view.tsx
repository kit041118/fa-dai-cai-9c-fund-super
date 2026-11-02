"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, Money, PageIntro } from "@/components/ui-bits";
import { useFund } from "@/components/fund-provider";
import { SCOPE_LABEL } from "@/lib/constants";
import { formatHkd, formatLongDate, hkMonthKey, monthLabel, payerName, shiftMonthKey, weekdayLabel } from "@/lib/format";
import type { Expense } from "@/lib/types";

export function LedgerView() {
  const fund = useFund();
  const family = fund.family;
  const [month, setMonth] = useState(hkMonthKey());
  const [payer, setPayer] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [methodId, setMethodId] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const current = hkMonthKey();

  const rows = useMemo(() => {
    return fund.expenses.filter((expense) => {
      if (!expense.spentOn.startsWith(month)) return false;
      if (payer && expense.payer !== payer) return false;
      if (categoryId && expense.categoryId !== categoryId) return false;
      if (methodId && expense.paymentMethodId !== methodId) return false;
      return true;
    });
  }, [fund.expenses, month, payer, categoryId, methodId]);

  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const expense of rows) {
      const list = map.get(expense.spentOn) ?? [];
      list.push(expense);
      map.set(expense.spentOn, list);
    }
    return [...map.entries()];
  }, [rows]);

  if (!family) return null;
  const filtered = Boolean(payer || categoryId || methodId);
  const monthTotal = rows.reduce((sum, expense) => sum + expense.amountCents, 0);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const result = await fund.removeExpense(pendingDelete.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.pending ? "已標記刪除，連線後同步" : "已刪除");
    setPendingDelete(null);
  }

  return (
    <div>
      <PageIntro title="紀錄" subtitle="按月份翻看，也可依付款人、類型和支付方式篩選。" />
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-card px-2 py-1 ring-1 ring-foreground/10">
        <button type="button" className="grid size-11 place-items-center rounded-xl" aria-label="上個月" onClick={() => setMonth((value) => shiftMonthKey(value, -1))}>
          <ChevronLeft className="size-5" />
        </button>
        <div className="text-center">
          <p className="font-heading text-lg font-semibold">{monthLabel(month)}</p>
          <p className="text-xs tabular-nums text-muted-foreground">{formatHkd(monthTotal)}</p>
        </div>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-xl disabled:opacity-30"
          aria-label="下個月"
          disabled={month >= current}
          onClick={() => setMonth((value) => shiftMonthKey(value, 1))}
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="mb-4 grid gap-2">
        <Filter label="付款人" value={payer} onChange={setPayer}>
          <option value="">全部付款人</option>
          <option value="boyfriend">{family.boyfriendName}</option>
          <option value="girlfriend">{family.girlfriendName}</option>
        </Filter>
        <Filter label="消費類型" value={categoryId} onChange={setCategoryId}>
          <option value="">全部類型</option>
          {family.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Filter>
        <Filter label="支付類型" value={methodId} onChange={setMethodId}>
          <option value="">全部支付</option>
          {family.paymentMethods.map((method) => (
            <option key={method.id} value={method.id}>
              {method.name}
            </option>
          ))}
        </Filter>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={filtered ? "沒有符合篩選的紀錄" : "這個月還沒有紀錄"}
          body={filtered ? "放寬條件，或改看其他月份。" : "新的支出會出現在這裡。"}
          action={
            filtered ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl"
                onClick={() => {
                  setPayer("");
                  setCategoryId("");
                  setMethodId("");
                }}
              >
                清除篩選
              </Button>
            ) : (
              <Link href="/entry" className="text-sm font-medium underline-offset-4 hover:underline">
                記一筆
              </Link>
            )
          }
        />
      ) : (
        <div className="grid gap-5">
          {groups.map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                {formatLongDate(date)} {weekdayLabel(date)}
              </h2>
              <ul className="grid gap-2">
                {items.map((expense) => (
                  <li key={expense.id} className="rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{expense.note || expense.categoryName}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {payerName(expense.payer, family)} · {expense.categoryName} · {expense.paymentMethodName}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <BadgeTone tone={expense.scope === "shared" ? "gold" : "sage"}>{SCOPE_LABEL[expense.scope]}</BadgeTone>
                          {expense.pending ? <BadgeTone tone="gold">離線暫存</BadgeTone> : null}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Money cents={expense.amountCents} className="font-medium" />
                        <div className="flex gap-1">
                          <Link href={`/entry/${expense.id}`} aria-label={`編輯${expense.note || expense.categoryName}`} className="grid size-9 place-items-center rounded-xl hover:bg-secondary">
                            <Pencil className="size-4" />
                          </Link>
                          <button type="button" aria-label={`刪除${expense.note || expense.categoryName}`} className="grid size-9 place-items-center rounded-xl text-destructive hover:bg-destructive/10" onClick={() => setPendingDelete(expense)}>
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確定刪除這筆記錄？</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `${pendingDelete.note || pendingDelete.categoryName} · ${formatHkd(pendingDelete.amountCents)}。刪除後無法還原。`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-0 bg-transparent sm:justify-stretch">
            <Button type="button" variant="outline" className="h-11 rounded-2xl" onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button type="button" variant="destructive" className="h-11 rounded-2xl" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "刪除中…" : "刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-2xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      {children}
    </select>
  );
}

function BadgeTone({ children, tone }: { children: React.ReactNode; tone: "gold" | "sage" }) {
  return (
    <span className={tone === "gold" ? "rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-medium text-foreground" : "rounded-full bg-sage px-2 py-0.5 text-[11px] font-medium text-sage-ink"}>
      {children}
    </span>
  );
}
