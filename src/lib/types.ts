export type Role = "boyfriend" | "girlfriend";
export type Scope = "shared" | "personal";
export type ConcertStatus = "on_sale" | "sold_out" | "ended" | "upcoming";
export type SyncPhase = "synced" | "syncing" | "pending";

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role | null;
  familyId: string | null;
};

export type NamedItem = {
  id: string;
  name: string;
  sortOrder: number;
};

export type Wish = {
  id: string;
  title: string;
  budgetCents: number | null;
};

export type Member = {
  id: string;
  email: string;
  displayName: string;
  role: Role | null;
};

export type FamilyBundle = {
  id: string;
  inviteCode: string;
  boyfriendName: string;
  girlfriendName: string;
  monthlyGoalCents: number;
  categories: NamedItem[];
  paymentMethods: NamedItem[];
  wishes: Wish[];
  members: Member[];
};

export type Expense = {
  id: string;
  amountCents: number;
  payer: Role;
  paymentMethodId: string;
  paymentMethodName: string;
  categoryId: string;
  categoryName: string;
  spentOn: string;
  note: string;
  scope: Scope;
  createdBy: string;
  updatedAt: string;
  pending?: boolean;
};

export type ExpenseUpsert = {
  id: string;
  amountCents: number;
  payer: Role;
  paymentMethodId: string;
  categoryId: string;
  spentOn: string;
  note: string;
  scope: Scope;
};

export type Recipe = {
  id: string;
  title: string;
  photoUrl: string;
  ingredients: string[];
  steps: string[];
  servings: number;
  lastCookedOn: string | null;
  pending?: boolean;
};

export type Concert = {
  id: string;
  artist: string;
  title: string;
  venue: string;
  eventDate: string;
  status: ConcertStatus;
  note: string;
};

export type Bootstrap = {
  user: PublicUser;
  family: FamilyBundle | null;
  expenses: Expense[];
  recipes: Recipe[];
  concerts: Concert[];
};

export type SyncOp =
  | { opId: string; kind: "expense.upsert"; expense: ExpenseUpsert }
  | { opId: string; kind: "expense.delete"; id: string }
  | { opId: string; kind: "recipe.cooked"; id: string; cookedOn: string | null };

export type SyncResult = {
  applied: string[];
  rejected: { opId: string; error: string }[];
};
