import type { Metadata } from "next";
import { SetupView } from "@/components/setup-view";

export const metadata: Metadata = { title: "建立家庭" };

export default function Page() {
  return <SetupView />;
}
