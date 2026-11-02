import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { DatabaseSync } from "node:sqlite";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PAYMENT_METHODS,
  DEMO_EMAIL,
  DEMO_INVITE_CODE,
  DEMO_PARTNER_EMAIL,
  DEMO_PASSWORD,
} from "@/lib/constants";
import { buildExpenseCsv, type CsvExpense } from "@/lib/csv";
import { hkToday, payerName, shiftDays, shiftMonthKey } from "@/lib/format";
import type {
  Concert,
  Expense,
  ExpenseUpsert,
  FamilyBundle,
  Member,
  NamedItem,
  PublicUser,
  Recipe,
  Role,
  SyncOp,
  SyncResult,
  Wish,
} from "@/lib/types";

export type DbUser = PublicUser & {
  passwordHash: string | null;
  oauthProvider: string | null;
  oauthSubject: string | null;
};

type SqlValue = string | number | null | bigint;
type Row = Record<string, SqlValue>;

let db: DatabaseSync | null = null;

function databasePath() {
  return process.env.FAMILY_FUND_DB || path.join(process.cwd(), "data", "family-fund.db");
}

export function getDb() {
  if (db) return db;
  const file = databasePath();
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const instance = new DatabaseSync(file);
  instance.exec("PRAGMA journal_mode = WAL;");
  instance.exec("PRAGMA foreign_keys = ON;");
  migrate(instance);
  db = instance;
  seedIfEmpty();
  return instance;
}

export function resetDbForTests(file: string) {
  if (db) db.close();
  db = null;
  process.env.FAMILY_FUND_DB = file;
}

function all(sql: string, ...params: SqlValue[]): Row[] {
  getDb();
  return db!.prepare(sql).all(...params) as Row[];
}

function one(sql: string, ...params: SqlValue[]): Row | undefined {
  getDb();
  return db!.prepare(sql).get(...params) as Row | undefined;
}

function run(sql: string, ...params: SqlValue[]) {
  getDb();
  return db!.prepare(sql).run(...params);
}

function migrate(instance: DatabaseSync) {
  instance.exec(`
    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      invite_code TEXT NOT NULL UNIQUE,
      boyfriend_name TEXT NOT NULL DEFAULT '男朋友',
      girlfriend_name TEXT NOT NULL DEFAULT '女朋友',
      monthly_goal_cents INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      display_name TEXT NOT NULL,
      family_id TEXT REFERENCES families(id),
      role TEXT,
      oauth_provider TEXT,
      oauth_subject TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(family_id, name)
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(family_id, name)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      payer TEXT NOT NULL,
      payment_method_id TEXT NOT NULL REFERENCES payment_methods(id),
      category_id TEXT NOT NULL REFERENCES categories(id),
      spent_on TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      scope TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wishes (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      budget_cents INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      photo_url TEXT NOT NULL DEFAULT '',
      ingredients TEXT NOT NULL,
      steps TEXT NOT NULL,
      servings INTEGER NOT NULL,
      last_cooked_on TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS concerts (
      id TEXT PRIMARY KEY,
      artist TEXT NOT NULL,
      title TEXT NOT NULL,
      venue TEXT NOT NULL,
      event_date TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sync_ops (
      op_id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      verifier TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_family_date ON expenses(family_id, spent_on);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_subject);
  `);
}

function seedIfEmpty() {
  if (process.env.FAMILY_FUND_SEED === "0") return;
  const row = one("SELECT COUNT(*) AS n FROM users");
  if (Number(row?.n ?? 0) > 0) return;
  db!.exec("BEGIN");
  try {
    seedDemo();
    db!.exec("COMMIT");
  } catch (error) {
    try {
      db!.exec("ROLLBACK");
    } catch {
      /* already closed */
    }
    throw error;
  }
}

function seedDemo() {
  const alex = createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    displayName: "Alex",
  });
  const may = createUser({
    email: DEMO_PARTNER_EMAIL,
    password: DEMO_PASSWORD,
    displayName: "May",
  });
  const created = createFamily(alex.id, "boyfriend", DEMO_INVITE_CODE);
  if ("error" in created) throw new Error(created.error);
  const family = created.family;
  const joined = joinFamily(may.id, DEMO_INVITE_CODE);
  if ("error" in joined) throw new Error(joined.error);

  const payme = addPaymentMethod(family.id, "PayMe");
  if ("error" in payme) throw new Error(payme.error);
  run(
    "UPDATE families SET monthly_goal_cents = ? WHERE id = ?",
    400_000,
    family.id,
  );

  const bundle = getFamilyBundle(family.id);
  if (!bundle) throw new Error("seed family missing");
  const categoryId = (name: string) => {
    const found = bundle.categories.find((item) => item.name === name);
    if (!found) throw new Error(`missing category ${name}`);
    return found.id;
  };
  const methodId = (name: string) => {
    const found = bundle.paymentMethods.find((item) => item.name === name);
    if (!found) throw new Error(`missing method ${name}`);
    return found.id;
  };

  const today = hkToday();
  const currentKey = today.slice(0, 7);
  const previousKey = shiftMonthKey(currentKey, -1);
  const day = (monthKey: string, date: number) => {
    const safe = Math.min(date, Number(monthBoundsEnd(monthKey)));
    return `${monthKey}-${String(safe).padStart(2, "0")}`;
  };

  const current: SeedExpense[] = [
    ["girlfriend", "餐飲", "信用卡", "shared", "78", "茶餐廳早餐", 1],
    ["boyfriend", "交通", "八達通", "personal", "16.90", "上班車費", 1],
    ["boyfriend", "居家", "信用卡", "shared", "246.80", "超市", 1],
    ["girlfriend", "居家", "信用卡", "shared", "520", "電費", 1],
    ["girlfriend", "餐飲", "信用卡", "shared", "388", "晚餐", 2],
    ["boyfriend", "娛樂", "信用卡", "shared", "190", "電影", 2],
    ["girlfriend", "交通", "八達通", "shared", "96", "的士", 2],
    ["boyfriend", "購物", "PayMe", "personal", "1280", "球鞋", 2],
    ["boyfriend", "醫療", "現金", "personal", "132", "藥房", 2],
    ["girlfriend", "娛樂", "現金", "personal", "48", "雜誌", 1],
  ];
  const previous: SeedExpense[] = [
    ["boyfriend", "餐飲", "信用卡", "shared", "860", "週末晚餐", 6],
    ["girlfriend", "交通", "八達通", "personal", "210.50", "月票加值", 3],
    ["girlfriend", "購物", "信用卡", "personal", "640", "外套", 9],
    ["boyfriend", "旅行", "信用卡", "shared", "2180", "澳門船票", 14],
    ["girlfriend", "餐飲", "現金", "shared", "156", "點心", 18],
    ["boyfriend", "居家", "現金", "shared", "320", "清潔用品", 22],
    ["girlfriend", "醫療", "信用卡", "personal", "450", "牙科", 25],
    ["boyfriend", "娛樂", "八達通", "personal", "180", "演唱會周邊", 28],
  ];

  for (const item of current) {
    insertExpenseDirect(family.id, alex.id, {
      id: crypto.randomUUID(),
      payer: item[0],
      categoryId: categoryId(item[1]),
      paymentMethodId: methodId(item[2]),
      scope: item[3],
      amountCents: toCents(item[4]),
      note: item[5],
      spentOn: day(currentKey, Math.min(item[6], Number(today.slice(8, 10)))),
    });
  }
  for (const item of previous) {
    insertExpenseDirect(family.id, alex.id, {
      id: crypto.randomUUID(),
      payer: item[0],
      categoryId: categoryId(item[1]),
      paymentMethodId: methodId(item[2]),
      scope: item[3],
      amountCents: toCents(item[4]),
      note: item[5],
      spentOn: day(previousKey, item[6]),
    });
  }

  const recipes = [
    {
      title: "番茄炒蛋",
      servings: 2,
      ingredients: ["雞蛋 3 隻", "番茄 2 個", "蔥 1 根", "鹽 少許", "糖 1/2 茶匙", "油 1 湯匙"],
      steps: ["番茄切件，蔥切段。", "蛋加少許鹽打散，先炒至剛凝固盛起。", "下番茄炒出汁，加糖，倒回雞蛋炒勻。"],
      cooked: true,
    },
    {
      title: "薑蔥蒸龍利",
      servings: 2,
      ingredients: ["龍利柳 2 塊", "薑 6 片", "蔥 2 根", "蒸魚豉油 1 湯匙", "油 1 湯匙"],
      steps: ["魚柳抹乾，鋪薑絲。", "水滾後蒸 6 分鐘。", "灑蔥絲，淋熱油及豉油。"],
      cooked: false,
    },
    {
      title: "豉汁蒸排骨",
      servings: 3,
      ingredients: ["排骨 400 克", "蒜蓉 1 湯匙", "豆豉 1 湯匙", "生抽 1 茶匙", "糖 1/2 茶匙", "生粉 1 茶匙"],
      steps: ["排骨加醃料拌勻，醃 20 分鐘。", "鋪平蒸 12 分鐘。", "可加少許蔥花。"],
      cooked: false,
    },
    {
      title: "蒜蓉菜心",
      servings: 2,
      ingredients: ["菜心 300 克", "蒜 4 瓣", "油 1 湯匙", "鹽 少許"],
      steps: ["菜心洗淨，蒜切末。", "蒜末爆香。", "下菜心快炒至莖仍爽脆。"],
      cooked: false,
    },
  ];
  for (const recipe of recipes) {
    run(
      `INSERT INTO recipes (id, family_id, title, photo_url, ingredients, steps, servings, last_cooked_on, created_by, created_at)
       VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      family.id,
      recipe.title,
      JSON.stringify(recipe.ingredients),
      JSON.stringify(recipe.steps),
      recipe.servings,
      recipe.cooked ? today : null,
      alex.id,
      new Date().toISOString(),
    );
  }

  const wishes = [
    ["聖誕東京旅行", 1_800_000],
    ["換一張床褥", 240_000],
    ["一起學煮甜品", null],
  ] as const;
  for (const [title, budget] of wishes) {
    run(
      "INSERT INTO wishes (id, family_id, title, budget_cents, created_at) VALUES (?, ?, ?, ?, ?)",
      crypto.randomUUID(),
      family.id,
      title,
      budget,
      new Date().toISOString(),
    );
  }

  const shows: Array<[string, string, string, number, Concert["status"], string]> = [
    ["陳奕迅", "FEAR AND DREAMS 香港站", "紅磡香港體育館", -48, "ended", "示範場次"],
    ["姜濤", "ON THE WAY", "麥花臣場館", -16, "ended", "示範場次"],
    ["張學友", "60+ 巡迴演唱會", "紅磡香港體育館", 18, "sold_out", "示範場次，並非即時票務"],
    ["鄧紫棋", "I AM GLORIA", "紅磡香港體育館", 10, "sold_out", "示範場次，並非即時票務"],
    ["林俊傑", "JJ20 世界巡迴演唱會", "亞洲國際博覽館", 21, "on_sale", "示範場次，並非即時票務"],
    ["五月天", "回到那一天", "中環海濱活動空間", 42, "on_sale", "示範場次，並非即時票務"],
    ["Ed Sheeran", "Mathematics 香港站", "啟德體育園", 60, "on_sale", "示範場次，並非即時票務"],
    ["周杰倫", "嘉年華世界巡迴香港站", "啟德體育園", 110, "upcoming", "示範場次，開售日期尚未公佈"],
  ];
  for (const show of shows) {
    run(
      `INSERT INTO concerts (id, artist, title, venue, event_date, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      show[0],
      show[1],
      show[2],
      shiftDays(today, show[3]),
      show[4],
      show[5],
    );
  }
}

type SeedExpense = [Role, string, string, "shared" | "personal", string, string, number];

function monthBoundsEnd(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toCents(amount: string) {
  const [dollars, fraction = ""] = amount.split(".");
  return Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
}

function insertExpenseDirect(
  familyId: string,
  userId: string,
  expense: ExpenseUpsert,
) {
  const now = new Date().toISOString();
  run(
    `INSERT INTO expenses (
      id, family_id, amount_cents, payer, payment_method_id, category_id, spent_on, note, scope, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    expense.id,
    familyId,
    expense.amountCents,
    expense.payer,
    expense.paymentMethodId,
    expense.categoryId,
    expense.spentOn,
    expense.note,
    expense.scope,
    userId,
    now,
    now,
  );
}

function mapUser(row: Row): DbUser {
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: row.password_hash == null ? null : String(row.password_hash),
    displayName: String(row.display_name),
    familyId: row.family_id == null ? null : String(row.family_id),
    role: row.role == null ? null : (String(row.role) as Role),
    oauthProvider: row.oauth_provider == null ? null : String(row.oauth_provider),
    oauthSubject: row.oauth_subject == null ? null : String(row.oauth_subject),
  };
}

export function toPublicUser(user: DbUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    familyId: user.familyId,
  };
}

export function createUser(input: {
  email: string;
  password: string | null;
  displayName: string;
  oauthProvider?: string | null;
  oauthSubject?: string | null;
}) {
  const id = crypto.randomUUID();
  const passwordHash = input.password ? bcrypt.hashSync(input.password, 10) : null;
  run(
    `INSERT INTO users (id, email, password_hash, display_name, oauth_provider, oauth_subject, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.email.toLowerCase(),
    passwordHash,
    input.displayName,
    input.oauthProvider ?? null,
    input.oauthSubject ?? null,
    new Date().toISOString(),
  );
  return findUserById(id)!;
}

export function findUserByEmail(email: string) {
  const row = one("SELECT * FROM users WHERE email = ?", email.toLowerCase());
  return row ? mapUser(row) : undefined;
}

export function findUserById(id: string) {
  const row = one("SELECT * FROM users WHERE id = ?", id);
  return row ? mapUser(row) : undefined;
}

export function findUserByOAuth(provider: string, subject: string) {
  const row = one(
    "SELECT * FROM users WHERE oauth_provider = ? AND oauth_subject = ?",
    provider,
    subject,
  );
  return row ? mapUser(row) : undefined;
}

export function verifyPassword(user: DbUser, password: string) {
  if (!user.passwordHash) return false;
  return bcrypt.compareSync(password, user.passwordHash);
}

export function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  run("DELETE FROM sessions WHERE expires_at <= ?", now.toISOString());
  run(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    crypto.randomUUID(),
    userId,
    tokenHash,
    expires.toISOString(),
    now.toISOString(),
  );
  return token;
}

export function deleteSession(token: string) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  run("DELETE FROM sessions WHERE token_hash = ?", tokenHash);
}

export function getUserBySessionToken(token: string) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = one(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    tokenHash,
    new Date().toISOString(),
  );
  return row ? mapUser(row) : undefined;
}

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode() {
  const bytes = crypto.randomBytes(6);
  return [...bytes].map((byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join("");
}

export function createFamily(userId: string, role: Role, preferredCode?: string) {
  const user = findUserById(userId);
  if (!user) return { error: "找不到使用者" as const };
  if (user.familyId) return { error: "你已經在一個家庭裡" as const };
  let inviteCode = preferredCode ?? generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const exists = one("SELECT id FROM families WHERE invite_code = ?", inviteCode);
    if (!exists) break;
    if (preferredCode) return { error: "邀請碼已被使用" as const };
    inviteCode = generateInviteCode();
  }
  const familyId = crypto.randomUUID();
  const now = new Date().toISOString();
  run(
    `INSERT INTO families (id, invite_code, boyfriend_name, girlfriend_name, monthly_goal_cents, created_at)
     VALUES (?, ?, '男朋友', '女朋友', 0, ?)`,
    familyId,
    inviteCode,
    now,
  );
  DEFAULT_CATEGORIES.forEach((name, index) => {
    run(
      "INSERT INTO categories (id, family_id, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
      crypto.randomUUID(),
      familyId,
      name,
      index,
      now,
    );
  });
  DEFAULT_PAYMENT_METHODS.forEach((name, index) => {
    run(
      "INSERT INTO payment_methods (id, family_id, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
      crypto.randomUUID(),
      familyId,
      name,
      index,
      now,
    );
  });
  run("UPDATE users SET family_id = ?, role = ? WHERE id = ?", familyId, role, userId);
  const family = getFamilyBundle(familyId);
  if (!family) return { error: "建立家庭失敗" as const };
  return { family };
}

export function joinFamily(userId: string, code: string) {
  const user = findUserById(userId);
  if (!user) return { error: "找不到使用者" as const };
  if (user.familyId) return { error: "你已經在一個家庭裡" as const };
  const family = one("SELECT * FROM families WHERE invite_code = ?", code.toUpperCase());
  if (!family) return { error: "邀請碼不正確，請再核對一次" as const };
  const familyId = String(family.id);
  const members = all("SELECT role FROM users WHERE family_id = ?", familyId);
  if (members.length >= 2) return { error: "這個家庭已經有兩位成員" as const };
  const roles = members.map((member) => String(member.role));
  const role: Role = roles.includes("boyfriend") ? "girlfriend" : "boyfriend";
  run("UPDATE users SET family_id = ?, role = ? WHERE id = ?", familyId, role, userId);
  const bundle = getFamilyBundle(familyId);
  if (!bundle) return { error: "加入家庭失敗" as const };
  return { family: bundle };
}

export function getFamilyBundle(familyId: string): FamilyBundle | null {
  const family = one("SELECT * FROM families WHERE id = ?", familyId);
  if (!family) return null;
  const categories = all(
    "SELECT * FROM categories WHERE family_id = ? ORDER BY sort_order, name",
    familyId,
  ).map(mapNamed);
  const paymentMethods = all(
    "SELECT * FROM payment_methods WHERE family_id = ? ORDER BY sort_order, name",
    familyId,
  ).map(mapNamed);
  const wishes = all(
    "SELECT * FROM wishes WHERE family_id = ? ORDER BY created_at",
    familyId,
  ).map(mapWish);
  const members: Member[] = all(
    "SELECT id, email, display_name, role FROM users WHERE family_id = ? ORDER BY created_at",
    familyId,
  ).map((row) => ({
    id: String(row.id),
    email: String(row.email),
    displayName: String(row.display_name),
    role: row.role == null ? null : (String(row.role) as Role),
  }));
  return {
    id: familyId,
    inviteCode: String(family.invite_code),
    boyfriendName: String(family.boyfriend_name),
    girlfriendName: String(family.girlfriend_name),
    monthlyGoalCents: Number(family.monthly_goal_cents),
    categories,
    paymentMethods,
    wishes,
    members,
  };
}

function mapNamed(row: Row): NamedItem {
  return { id: String(row.id), name: String(row.name), sortOrder: Number(row.sort_order) };
}

function mapWish(row: Row): Wish {
  return {
    id: String(row.id),
    title: String(row.title),
    budgetCents: row.budget_cents == null ? null : Number(row.budget_cents),
  };
}

export function listExpenses(familyId: string): Expense[] {
  return all(
    `SELECT e.*, c.name AS category_name, p.name AS payment_method_name
     FROM expenses e
     JOIN categories c ON c.id = e.category_id
     JOIN payment_methods p ON p.id = e.payment_method_id
     WHERE e.family_id = ?
     ORDER BY e.spent_on DESC, e.created_at DESC`,
    familyId,
  ).map(mapExpense);
}

function mapExpense(row: Row): Expense {
  return {
    id: String(row.id),
    amountCents: Number(row.amount_cents),
    payer: String(row.payer) as Role,
    paymentMethodId: String(row.payment_method_id),
    paymentMethodName: String(row.payment_method_name),
    categoryId: String(row.category_id),
    categoryName: String(row.category_name),
    spentOn: String(row.spent_on),
    note: String(row.note ?? ""),
    scope: String(row.scope) as Expense["scope"],
    createdBy: String(row.created_by),
    updatedAt: String(row.updated_at),
  };
}

export function upsertExpense(familyId: string, userId: string, expense: ExpenseUpsert) {
  const existing = one("SELECT family_id, created_by, created_at FROM expenses WHERE id = ?", expense.id);
  const now = new Date().toISOString();
  if (existing) {
    if (String(existing.family_id) !== familyId) return { error: "找不到這筆支出" as const };
    run(
      `UPDATE expenses
       SET amount_cents = ?, payer = ?, payment_method_id = ?, category_id = ?, spent_on = ?, note = ?, scope = ?, updated_at = ?
       WHERE id = ? AND family_id = ?`,
      expense.amountCents,
      expense.payer,
      expense.paymentMethodId,
      expense.categoryId,
      expense.spentOn,
      expense.note,
      expense.scope,
      now,
      expense.id,
      familyId,
    );
  } else {
    run(
      `INSERT INTO expenses (
        id, family_id, amount_cents, payer, payment_method_id, category_id, spent_on, note, scope, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      expense.id,
      familyId,
      expense.amountCents,
      expense.payer,
      expense.paymentMethodId,
      expense.categoryId,
      expense.spentOn,
      expense.note,
      expense.scope,
      userId,
      now,
      now,
    );
  }
  const saved = listExpenses(familyId).find((item) => item.id === expense.id);
  if (!saved) return { error: "儲存失敗" as const };
  return { expense: saved };
}

export function deleteExpense(familyId: string, id: string) {
  run("DELETE FROM expenses WHERE id = ? AND family_id = ?", id, familyId);
  return { ok: true as const };
}

export function updateFamilySettings(
  familyId: string,
  input: { boyfriendName: string; girlfriendName: string; monthlyGoalCents: number },
) {
  run(
    `UPDATE families
     SET boyfriend_name = ?, girlfriend_name = ?, monthly_goal_cents = ?
     WHERE id = ?`,
    input.boyfriendName,
    input.girlfriendName,
    input.monthlyGoalCents,
    familyId,
  );
  return getFamilyBundle(familyId);
}

export function addCategory(familyId: string, name: string) {
  return addNamed("categories", familyId, name, "已經有這個消費類型");
}

export function deleteCategory(familyId: string, id: string) {
  const count = Number(one("SELECT COUNT(*) AS n FROM categories WHERE family_id = ?", familyId)?.n ?? 0);
  if (count <= 1) return { error: "至少保留一個消費類型" as const };
  const used = Number(one("SELECT COUNT(*) AS n FROM expenses WHERE category_id = ?", id)?.n ?? 0);
  if (used > 0) return { error: "已有支出使用此類型，無法刪除" as const };
  const owned = one("SELECT id FROM categories WHERE id = ? AND family_id = ?", id, familyId);
  if (!owned) return { error: "找不到此類型" as const };
  run("DELETE FROM categories WHERE id = ?", id);
  return { ok: true as const };
}

export function addPaymentMethod(familyId: string, name: string) {
  return addNamed("payment_methods", familyId, name, "已經有這個支付類型");
}

export function deletePaymentMethod(familyId: string, id: string) {
  const count = Number(
    one("SELECT COUNT(*) AS n FROM payment_methods WHERE family_id = ?", familyId)?.n ?? 0,
  );
  if (count <= 1) return { error: "至少保留一個支付類型" as const };
  const used = Number(one("SELECT COUNT(*) AS n FROM expenses WHERE payment_method_id = ?", id)?.n ?? 0);
  if (used > 0) return { error: "已有支出使用此支付類型，無法刪除" as const };
  const owned = one("SELECT id FROM payment_methods WHERE id = ? AND family_id = ?", id, familyId);
  if (!owned) return { error: "找不到此支付類型" as const };
  run("DELETE FROM payment_methods WHERE id = ?", id);
  return { ok: true as const };
}

function addNamed(
  table: "categories" | "payment_methods",
  familyId: string,
  name: string,
  duplicate: string,
) {
  const exists = one(`SELECT id FROM ${table} WHERE family_id = ? AND name = ?`, familyId, name);
  if (exists) return { error: duplicate as string };
  const sort = Number(
    one(`SELECT COALESCE(MAX(sort_order), -1) AS n FROM ${table} WHERE family_id = ?`, familyId)?.n ?? -1,
  );
  const id = crypto.randomUUID();
  run(
    `INSERT INTO ${table} (id, family_id, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)`,
    id,
    familyId,
    name,
    sort + 1,
    new Date().toISOString(),
  );
  return { id, name };
}

export function addWish(familyId: string, title: string, budgetCents: number | null) {
  const id = crypto.randomUUID();
  run(
    "INSERT INTO wishes (id, family_id, title, budget_cents, created_at) VALUES (?, ?, ?, ?, ?)",
    id,
    familyId,
    title,
    budgetCents,
    new Date().toISOString(),
  );
  return { id };
}

export function deleteWish(familyId: string, id: string) {
  run("DELETE FROM wishes WHERE id = ? AND family_id = ?", id, familyId);
  return { ok: true as const };
}

export function listRecipes(familyId: string): Recipe[] {
  return all(
    "SELECT * FROM recipes WHERE family_id = ? ORDER BY created_at DESC",
    familyId,
  ).map(mapRecipe);
}

function mapRecipe(row: Row): Recipe {
  return {
    id: String(row.id),
    title: String(row.title),
    photoUrl: String(row.photo_url ?? ""),
    ingredients: JSON.parse(String(row.ingredients)) as string[],
    steps: JSON.parse(String(row.steps)) as string[],
    servings: Number(row.servings),
    lastCookedOn: row.last_cooked_on == null ? null : String(row.last_cooked_on),
  };
}

export function createRecipe(
  familyId: string,
  userId: string,
  input: { title: string; photoUrl: string; ingredients: string[]; steps: string[]; servings: number },
) {
  const id = crypto.randomUUID();
  run(
    `INSERT INTO recipes (id, family_id, title, photo_url, ingredients, steps, servings, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    familyId,
    input.title,
    input.photoUrl,
    JSON.stringify(input.ingredients),
    JSON.stringify(input.steps),
    input.servings,
    userId,
    new Date().toISOString(),
  );
  return listRecipes(familyId).find((recipe) => recipe.id === id)!;
}

export function deleteRecipe(familyId: string, id: string) {
  run("DELETE FROM recipes WHERE id = ? AND family_id = ?", id, familyId);
  return { ok: true as const };
}

export function setRecipeCooked(familyId: string, id: string, cookedOn: string | null) {
  const owned = one("SELECT id FROM recipes WHERE id = ? AND family_id = ?", id, familyId);
  if (!owned) return { error: "找不到食譜" as const };
  run("UPDATE recipes SET last_cooked_on = ? WHERE id = ?", cookedOn, id);
  return { ok: true as const };
}

export function listConcerts(): Concert[] {
  return all("SELECT * FROM concerts ORDER BY event_date ASC").map((row) => ({
    id: String(row.id),
    artist: String(row.artist),
    title: String(row.title),
    venue: String(row.venue),
    eventDate: String(row.event_date),
    status: String(row.status) as Concert["status"],
    note: String(row.note ?? ""),
  }));
}

export function expenseCsv(familyId: string) {
  const family = getFamilyBundle(familyId);
  if (!family) return "";
  const rows: CsvExpense[] = listExpenses(familyId)
    .slice()
    .sort((a, b) => a.spentOn.localeCompare(b.spentOn))
    .map((expense) => ({
      spentOn: expense.spentOn,
      payerName: payerName(expense.payer, family),
      paymentMethod: expense.paymentMethodName,
      category: expense.categoryName,
      amountCents: expense.amountCents,
      scope: expense.scope,
      note: expense.note,
    }));
  return buildExpenseCsv(rows);
}

export function applySyncOps(familyId: string, userId: string, ops: SyncOp[]): SyncResult {
  const applied: string[] = [];
  const rejected: SyncResult["rejected"] = [];
  const family = getFamilyBundle(familyId);
  if (!family) return { applied, rejected: ops.map((op) => ({ opId: op.opId, error: "找不到家庭" })) };
  for (const op of ops) {
    const seen = one("SELECT op_id FROM sync_ops WHERE op_id = ?", op.opId);
    if (seen) {
      applied.push(op.opId);
      continue;
    }
    try {
      db!.exec("BEGIN");
      if (op.kind === "expense.upsert") {
        const categoryOk = family.categories.some((item) => item.id === op.expense.categoryId);
        const methodOk = family.paymentMethods.some((item) => item.id === op.expense.paymentMethodId);
        if (!categoryOk || !methodOk) throw new Error("類型或支付方式已不存在，請重新選擇");
        const result = upsertExpense(familyId, userId, op.expense);
        if ("error" in result) throw new Error(result.error);
      } else if (op.kind === "expense.delete") {
        deleteExpense(familyId, op.id);
      } else if (op.kind === "recipe.cooked") {
        const result = setRecipeCooked(familyId, op.id, op.cookedOn);
        if ("error" in result) throw new Error(result.error);
      }
      run(
        "INSERT INTO sync_ops (op_id, family_id, applied_at) VALUES (?, ?, ?)",
        op.opId,
        familyId,
        new Date().toISOString(),
      );
      db!.exec("COMMIT");
      applied.push(op.opId);
    } catch (error) {
      try {
        db!.exec("ROLLBACK");
      } catch {
        /* ignore */
      }
      rejected.push({
        opId: op.opId,
        error: error instanceof Error ? error.message : "同步失敗",
      });
    }
  }
  return { applied, rejected };
}

export function saveOAuthState(provider: string, verifier: string) {
  const state = crypto.randomBytes(16).toString("base64url");
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  run("DELETE FROM oauth_states WHERE expires_at <= ?", new Date().toISOString());
  run(
    "INSERT INTO oauth_states (state, provider, verifier, expires_at) VALUES (?, ?, ?, ?)",
    state,
    provider,
    verifier,
    expires,
  );
  return state;
}

export function takeOAuthState(state: string, provider: string) {
  const row = one(
    "SELECT * FROM oauth_states WHERE state = ? AND provider = ? AND expires_at > ?",
    state,
    provider,
    new Date().toISOString(),
  );
  if (!row) return undefined;
  run("DELETE FROM oauth_states WHERE state = ?", state);
  return { verifier: String(row.verifier) };
}

export function upsertOAuthUser(input: {
  provider: "google" | "x";
  subject: string;
  email: string;
  displayName: string;
}) {
  const email = input.email.toLowerCase();
  const linked = findUserByOAuth(input.provider, input.subject);
  if (linked) return linked;
  const existing = findUserByEmail(email);
  if (existing) {
    run(
      "UPDATE users SET oauth_provider = ?, oauth_subject = ? WHERE id = ?",
      input.provider,
      input.subject,
      existing.id,
    );
    return findUserById(existing.id)!;
  }
  return createUser({
    email,
    password: null,
    displayName: input.displayName.slice(0, 20) || "家人",
    oauthProvider: input.provider,
    oauthSubject: input.subject,
  });
}
