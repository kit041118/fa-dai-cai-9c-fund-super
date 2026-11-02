import type { Expense, ExpenseUpsert, FamilyBundle, Recipe, SyncOp } from "@/lib/types";

const QUEUE_KEY = "ff.queue.v1";
const CACHE_KEY = "ff.cache.v1";

const memory = new Map<string, string>();

function readRaw(key: string): string | null {
  if (typeof window === "undefined") return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeRaw(key: string, value: string | null) {
  if (typeof window === "undefined") {
    if (value == null) memory.delete(key);
    else memory.set(key, value);
    return;
  }
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    if (value == null) memory.delete(key);
    else memory.set(key, value);
  }
}

export function loadQueue(): SyncOp[] {
  const raw = readRaw(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SyncOp[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQueue(queue: SyncOp[]) {
  writeRaw(QUEUE_KEY, JSON.stringify(queue));
}

export function clearLocalFund() {
  writeRaw(QUEUE_KEY, null);
  writeRaw(CACHE_KEY, null);
}

export function loadCache<T>(): T | null {
  const raw = readRaw(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveCache(value: unknown) {
  writeRaw(CACHE_KEY, JSON.stringify(value));
}

export function queueExpenseUpsert(queue: SyncOp[], expense: ExpenseUpsert): SyncOp[] {
  const next = queue.filter((op) => {
    if (op.kind === "expense.upsert" && op.expense.id === expense.id) return false;
    if (op.kind === "expense.delete" && op.id === expense.id) return false;
    return true;
  });
  next.push({ opId: crypto.randomUUID(), kind: "expense.upsert", expense });
  return next;
}

export function queueExpenseDelete(queue: SyncOp[], id: string, onServer: boolean): SyncOp[] {
  const next = queue.filter((op) => {
    if (op.kind === "expense.upsert" && op.expense.id === id) return false;
    if (op.kind === "expense.delete" && op.id === id) return false;
    return true;
  });
  if (onServer) next.push({ opId: crypto.randomUUID(), kind: "expense.delete", id });
  return next;
}

export function queueRecipeCooked(queue: SyncOp[], id: string, cookedOn: string | null): SyncOp[] {
  const next = queue.filter((op) => !(op.kind === "recipe.cooked" && op.id === id));
  next.push({ opId: crypto.randomUUID(), kind: "recipe.cooked", id, cookedOn });
  return next;
}

export function mergeExpenses(
  expenses: Expense[],
  queue: SyncOp[],
  family: FamilyBundle | null,
): Expense[] {
  const map = new Map(expenses.map((expense) => [expense.id, { ...expense, pending: false }]));
  for (const op of queue) {
    if (op.kind === "expense.delete") {
      map.delete(op.id);
      continue;
    }
    if (op.kind !== "expense.upsert") continue;
    const prev = map.get(op.expense.id);
    const category = family?.categories.find((item) => item.id === op.expense.categoryId);
    const method = family?.paymentMethods.find((item) => item.id === op.expense.paymentMethodId);
    map.set(op.expense.id, {
      id: op.expense.id,
      amountCents: op.expense.amountCents,
      payer: op.expense.payer,
      paymentMethodId: op.expense.paymentMethodId,
      paymentMethodName: method?.name ?? prev?.paymentMethodName ?? "支付",
      categoryId: op.expense.categoryId,
      categoryName: category?.name ?? prev?.categoryName ?? "類型",
      spentOn: op.expense.spentOn,
      note: op.expense.note,
      scope: op.expense.scope,
      createdBy: prev?.createdBy ?? "",
      updatedAt: prev?.updatedAt ?? "",
      pending: true,
    });
  }
  return [...map.values()].sort((a, b) => {
    const byDate = b.spentOn.localeCompare(a.spentOn);
    if (byDate !== 0) return byDate;
    return b.id.localeCompare(a.id);
  });
}

export function mergeRecipes(recipes: Recipe[], queue: SyncOp[]): Recipe[] {
  const map = new Map(recipes.map((recipe) => [recipe.id, { ...recipe, pending: false }]));
  for (const op of queue) {
    if (op.kind !== "recipe.cooked") continue;
    const recipe = map.get(op.id);
    if (!recipe) continue;
    map.set(op.id, { ...recipe, lastCookedOn: op.cookedOn, pending: true });
  }
  return [...map.values()];
}
