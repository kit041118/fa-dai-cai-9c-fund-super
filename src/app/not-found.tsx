import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center px-6">
      <Logo />
      <h1 className="mt-8 font-heading text-3xl font-semibold">找不到這個頁面</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">網址可能打錯了。記帳、報告和設定都在主畫面裡。</p>
      <Link href="/" className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-5 text-primary-foreground">
        返回總覽
      </Link>
    </div>
  );
}
