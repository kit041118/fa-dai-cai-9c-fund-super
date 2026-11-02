import type { Metadata } from "next";
import { SettingsView } from "@/components/settings-view";

export const metadata: Metadata = { title: "設定" };

export default function Page() {
  return <SettingsView />;
}
