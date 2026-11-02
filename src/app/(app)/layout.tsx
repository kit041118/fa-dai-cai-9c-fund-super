import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { FundProvider } from "@/components/fund-provider";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <FundProvider>
      <AppShell>{children}</AppShell>
    </FundProvider>
  );
}
