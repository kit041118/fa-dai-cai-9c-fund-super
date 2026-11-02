import type { Metadata } from "next";
import { ReportView } from "@/components/report-view";

export const metadata: Metadata = { title: "報告" };

export default function Page() {
  return <ReportView />;
}
