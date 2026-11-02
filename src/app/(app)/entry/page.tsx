import type { Metadata } from "next";
import { EntryView } from "@/components/entry-view";

export const metadata: Metadata = { title: "記一筆" };

export default function Page() {
  return <EntryView />;
}
