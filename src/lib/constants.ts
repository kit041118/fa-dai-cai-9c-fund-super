import type { ConcertStatus, Role, Scope } from "@/lib/types";

export const APP_NAME = "發大財家庭基金";
export const APP_MARK = "9F MONEY";

export const DEMO_EMAIL = "demo@9fmoney.hk";
export const DEMO_PARTNER_EMAIL = "partner@9fmoney.hk";
export const DEMO_PASSWORD = "familyfund";
export const DEMO_INVITE_CODE = "9FM88K";

export const DEFAULT_CATEGORIES = [
  "餐飲",
  "交通",
  "娛樂",
  "購物",
  "居家",
  "旅行",
  "醫療",
  "其他",
] as const;

export const DEFAULT_PAYMENT_METHODS = ["現金", "信用卡", "八達通"] as const;

export const ROLE_DEFAULT_NAME: Record<Role, string> = {
  boyfriend: "男朋友",
  girlfriend: "女朋友",
};

export const SCOPE_LABEL: Record<Scope, string> = {
  shared: "共同",
  personal: "個人",
};

export const CONCERT_STATUS_LABEL: Record<ConcertStatus, string> = {
  on_sale: "售票中",
  sold_out: "已售罄",
  ended: "已完結",
  upcoming: "即將開售",
};

export const CHART_COLORS = [
  "#C46B4A",
  "#3E6B78",
  "#C4A15A",
  "#7D6A99",
  "#6E8B74",
  "#4E7C8A",
  "#A85A62",
  "#8A8175",
  "#3E5468",
  "#B56B3A",
];

export const SESSION_COOKIE = "ff_session";
export const SESSION_DAYS = 30;
