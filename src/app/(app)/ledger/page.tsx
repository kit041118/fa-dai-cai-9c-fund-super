import type { Metadata } from "next";
import { LedgerView } from "@/components/ledger-view";

export const metadata: Metadata = { title: "紀錄" };

export default function Page() {
  return <LedgerView />;
}
