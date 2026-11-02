"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  clearLocalFund,
  loadCache,
  loadQueue,
  mergeExpenses,
  mergeRecipes,
  queueExpenseDelete,
  queueExpenseUpsert,
  queueRecipeCooked,
  saveCache,
  saveQueue,
} from "@/lib/sync";
import type { Bootstrap, Expense, ExpenseUpsert, FamilyBundle, PublicUser, Recipe, Concert, SyncOp, SyncPhase, SyncResult } from "@/lib/types";

type Status = "loading" | "ready" | "guest" | "offline";

type FundContextValue = {
  status: Status;
  user: PublicUser | null;
  family: FamilyBundle | null;
  expenses: Expense[];
  recipes: Recipe[];
  concerts: Concert[];
  syncPhase: SyncPhase;
  queueCount: number;
  bootError: string | null;
  refresh: () => Promise<void>;
  saveExpense: (
    expense: ExpenseUpsert,
  ) => Promise<{ ok: true; pending: boolean } | { ok: false; error: string; fields?: Record<string, string> }>;
  removeExpense: (id: string) => Promise<{ ok: true; pending: boolean } | { ok: false; error: string }>;
  markCooked: (
    id: string,
    cookedOn: string | null,
  ) => Promise<{ ok: true; pending: boolean } | { ok: false; error: string }>;
};

const FundContext = createContext<FundContextValue | null>(null);

export function FundProvider({ children }: { children: ReactNode }) {
  const serverRef = useRef<Bootstrap | null>(null);
  const syncingRef = useRef(false);
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [family, setFamily] = useState<FamilyBundle | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [syncPhase, setSyncPhase] = useState<SyncPhase>("synced");
  const [queueCount, setQueueCount] = useState(0);
  const [bootError, setBootError] = useState<string | null>(null);

  const publish = useCallback((data: Bootstrap | null, queue: SyncOp[]) => {
    const phase: SyncPhase = syncingRef.current ? "syncing" : queue.length ? "pending" : "synced";
    setQueueCount(queue.length);
    setSyncPhase(phase);
    if (!data) return;
    serverRef.current = data;
    setUser(data.user);
    setFamily(data.family);
    setExpenses(mergeExpenses(data.expenses, queue, data.family));
    setRecipes(mergeRecipes(data.recipes, queue));
    setConcerts(data.concerts);
    setBootError(null);
    setStatus("ready");
  }, []);

  const refresh = useCallback(async () => {
    const result = await api<Bootstrap>("/api/bootstrap");
    if (!result.ok) {
      if (result.status === 401) {
        clearLocalFund();
        serverRef.current = null;
        setStatus("guest");
        return;
      }
      if (!serverRef.current) {
        setStatus("offline");
        setBootError("無法連線。請檢查網絡後再試。");
      }
      return;
    }
    saveCache(result.data);
    publish(result.data, loadQueue());
  }, [publish]);

  const flush = useCallback(async () => {
    await Promise.resolve();
    let guard = 0;
    while (loadQueue().length > 0 && guard < 8) {
      guard += 1;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        syncingRef.current = false;
        publish(serverRef.current, loadQueue());
        return;
      }
      syncingRef.current = true;
      publish(serverRef.current, loadQueue());
      const batch = loadQueue().slice(0, 50);
      const result = await api<SyncResult>("/api/sync", {
        method: "POST",
        body: JSON.stringify({ ops: batch }),
      });
      syncingRef.current = false;
      if (!result.ok) {
        if (result.status === 401) {
          clearLocalFund();
          serverRef.current = null;
          setStatus("guest");
          return;
        }
        publish(serverRef.current, loadQueue());
        return;
      }
      const drop = new Set([...result.data.applied, ...result.data.rejected.map((item) => item.opId)]);
      saveQueue(loadQueue().filter((op) => !drop.has(op.opId)));
      if (result.data.rejected[0]) toast.error(result.data.rejected[0].error);
    }
    publish(serverRef.current, loadQueue());
  }, [publish]);

  useEffect(() => {
    let cancelled = false;
    const onOnline = () => {
      void flush().then(() => refresh());
    };
    window.addEventListener("online", onOnline);
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const cached = loadCache<Bootstrap>();
      if (cached) publish(cached, loadQueue());
      await flush();
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [flush, publish, refresh]);

  const saveExpense = useCallback(
    async (expense: ExpenseUpsert) => {
      if (navigator.onLine) {
        const result = await api<{ expense: Expense }>("/api/expenses", {
          method: "POST",
          body: JSON.stringify(expense),
        });
        if (result.ok) {
          await refresh();
          return { ok: true as const, pending: false };
        }
        if (result.status !== 0) return { ok: false as const, error: result.error, fields: result.fields };
      }
      const queue = queueExpenseUpsert(loadQueue(), expense);
      saveQueue(queue);
      publish(serverRef.current, queue);
      return { ok: true as const, pending: true };
    },
    [publish, refresh],
  );

  const removeExpense = useCallback(
    async (id: string) => {
      const onServer = serverRef.current?.expenses.some((expense) => expense.id === id) ?? false;
      if (navigator.onLine && onServer) {
        const result = await api(`/api/expenses/${id}`, { method: "DELETE" });
        if (result.ok) {
          await refresh();
          return { ok: true as const, pending: false };
        }
        if (result.status !== 0) return { ok: false as const, error: result.error };
      }
      const queue = queueExpenseDelete(loadQueue(), id, onServer);
      saveQueue(queue);
      publish(serverRef.current, queue);
      return { ok: true as const, pending: queue.some((op) => op.kind === "expense.delete" && op.id === id) };
    },
    [publish, refresh],
  );

  const markCooked = useCallback(
    async (id: string, cookedOn: string | null) => {
      if (navigator.onLine) {
        const result = await api(`/api/recipes/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ cookedOn }),
        });
        if (result.ok) {
          await refresh();
          return { ok: true as const, pending: false };
        }
        if (result.status !== 0) return { ok: false as const, error: result.error };
      }
      const queue = queueRecipeCooked(loadQueue(), id, cookedOn);
      saveQueue(queue);
      publish(serverRef.current, queue);
      return { ok: true as const, pending: true };
    },
    [publish, refresh],
  );

  const value = useMemo<FundContextValue>(
    () => ({
      status,
      user,
      family,
      expenses,
      recipes,
      concerts,
      syncPhase,
      queueCount,
      bootError,
      refresh,
      saveExpense,
      removeExpense,
      markCooked,
    }),
    [
      status,
      user,
      family,
      expenses,
      recipes,
      concerts,
      syncPhase,
      queueCount,
      bootError,
      refresh,
      saveExpense,
      removeExpense,
      markCooked,
    ],
  );

  return <FundContext value={value}>{children}</FundContext>;
}

export function useFund() {
  const value = useContext(FundContext);
  if (!value) throw new Error("useFund 必須在 FundProvider 內使用");
  return value;
}
