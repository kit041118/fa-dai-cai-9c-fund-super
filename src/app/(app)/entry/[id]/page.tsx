import type { Metadata } from "next";
import { EntryView } from "@/components/entry-view";

export const metadata: Metadata = { title: "編輯支出" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntryView expenseId={id} />;
}
