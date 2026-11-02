"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-3xl bg-card p-6 ring-1 ring-foreground/10">
      <h1 className="font-heading text-xl">頁面暫時無法顯示</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">請再試一次。若仍失敗，返回總覽即可。</p>
      <Button type="button" className="mt-4 h-12 rounded-2xl" onClick={() => reset()}>
        再試一次
      </Button>
    </div>
  );
}
