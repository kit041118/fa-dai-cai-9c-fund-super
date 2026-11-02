"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BookOpen,
  ChartPie,
  House,
  NotebookPen,
  Plus,
  Settings,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { useFund } from "@/components/fund-provider";
import type { SyncPhase } from "@/lib/types";

const NAV = [
  { href: "/", label: "總覽", icon: House },
  { href: "/entry", label: "記一筆", icon: Plus },
  { href: "/ledger", label: "紀錄", icon: NotebookPen },
  { href: "/report", label: "報告", icon: ChartPie },
  { href: "/life", label: "生活百科", icon: BookOpen },
  { href: "/settings", label: "設定", icon: Settings },
];

function syncLabel(phase: SyncPhase, count: number) {
  if (phase === "syncing") return "同步中";
  if (phase === "pending") return count > 1 ? `離線暫存 ${count}` : "離線暫存";
  return "已同步";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const fund = useFund();
  const needsSetup = fund.status === "ready" && !fund.family;
  const onSetup = pathname === "/setup";

  useEffect(() => {
    if (fund.status === "guest") {
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
    }
  }, [fund.status, pathname, router]);

  useEffect(() => {
    if (fund.status !== "ready") return;
    if (!fund.family && pathname !== "/setup") router.replace("/setup");
    if (fund.family && pathname === "/setup") router.replace("/");
  }, [fund.status, fund.family, pathname, router]);

  const waitingForRoute =
    fund.status === "loading" ||
    fund.status === "guest" ||
    (needsSetup && !onSetup) ||
    (fund.status === "ready" && Boolean(fund.family) && onSetup);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-card focus:px-3 focus:py-2"
      >
        跳至主要內容
      </a>
      <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-background/90 px-4 py-3 backdrop-blur-md">
          <Link href={fund.family ? "/" : "/setup"} aria-label="發大財家庭基金首頁">
            <Logo size="sm" />
          </Link>
          <p
            className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-medium ring-1 ring-foreground/10"
            aria-live="polite"
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                fund.syncPhase === "synced" && "bg-sage-ink",
                fund.syncPhase === "syncing" && "animate-pulse bg-gold",
                fund.syncPhase === "pending" && "bg-gold",
              )}
            />
            {syncLabel(fund.syncPhase, fund.queueCount)}
          </p>
        </header>
        <main id="main" className={cn("flex-1 px-4 pt-2", onSetup ? "pb-10" : "pb-28")}>
          {fund.status === "offline" ? (
            <div className="rounded-3xl bg-card p-6 text-center ring-1 ring-foreground/10">
              <h1 className="font-heading text-xl">無法連線</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{fund.bootError}</p>
              <Button type="button" className="mt-4 h-12 rounded-2xl px-6" onClick={() => void fund.refresh()}>
                再試一次
              </Button>
            </div>
          ) : waitingForRoute ? (
            <div className="space-y-3 py-4" aria-busy="true" aria-live="polite">
              <p className="sr-only">載入中</p>
              <div className="h-8 w-32 animate-pulse rounded-full bg-card" />
              <div className="h-36 animate-pulse rounded-3xl bg-card" />
              <div className="h-28 animate-pulse rounded-3xl bg-card" />
            </div>
          ) : (
            children
          )}
        </main>
        {fund.family && !onSetup ? <BottomNav pathname={pathname} /> : null}
      </div>
    </div>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="主要"
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[460px] -translate-x-1/2 border-t border-border bg-card/95 px-1 pt-1 backdrop-blur-md"
      style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
    >
      <ul className="grid grid-cols-6">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 text-[10px] leading-tight font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
