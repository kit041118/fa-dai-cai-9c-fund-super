import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth-screen";
import { safeNext } from "@/lib/api";

export const metadata: Metadata = { title: "註冊" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return <AuthScreen mode="register" nextPath={safeNext(params.next ?? null)} />;
}
