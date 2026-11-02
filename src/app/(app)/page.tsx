import type { Metadata } from "next";
import { OverviewView } from "@/components/overview-view";

export const metadata: Metadata = { title: "總覽" };

export default function Page() {
  return <OverviewView />;
}
