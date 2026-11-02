import type { Metadata } from "next";
import { LifeView } from "@/components/life-view";

export const metadata: Metadata = { title: "生活百科" };

export default function Page() {
  return <LifeView />;
}
