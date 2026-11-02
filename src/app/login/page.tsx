import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth-screen";
import { safeNext } from "@/lib/api";

export const metadata: Metadata = { title: "登入" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ oauth?: string; next?: string }>;
}) {
  const params = await searchParams;
  return <AuthScreen mode="login" nextPath={safeNext(params.next ?? null)} oauth={params.oauth ?? ""} />;
}
