"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { TextField } from "@/components/ui-bits";
import { DEMO_EMAIL, DEMO_PARTNER_EMAIL, DEMO_PASSWORD, DEMO_INVITE_CODE } from "@/lib/constants";
import { api } from "@/lib/api";
import type { PublicUser } from "@/lib/types";

export function AuthScreen({
  mode,
  nextPath = "/",
  oauth = "",
}: {
  mode: "login" | "register";
  nextPath?: string;
  oauth?: string;
}) {
  const router = useRouter();
  const next = nextPath;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  const oauthMessage =
    oauth === "google"
      ? "尚未設定 Google 登入。請在環境變數填入金鑰，或使用電郵登入。"
      : oauth === "x"
        ? "尚未設定 X 登入。請在環境變數填入金鑰，或使用電郵登入。"
        : oauth === "error"
          ? "第三方登入未完成，請改用電郵或稍後再試。"
          : "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setFormError("");
    setFields({});
    const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const result = await api<{ user: PublicUser }>(path, {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    });
    setPending(false);
    if (!result.ok) {
      setFormError(result.error);
      setFields(result.fields ?? {});
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function demo() {
    setPending(true);
    const result = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 py-10">
        <Logo size="lg" />
        <div className="mt-8">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {mode === "login" ? "登入家庭基金" : "註冊家庭基金"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            兩部手機可以登入同一個帳號；也可以各自註冊，再用 6 位邀請碼加入同一個家庭。帳目會互相同步。
          </p>
        </div>

        {oauthMessage ? (
          <p className="mt-4 rounded-2xl bg-accent px-3 py-2 text-sm leading-6 text-foreground" role="alert">
            {oauthMessage}
          </p>
        ) : null}

        <div className="mt-6 grid gap-3">
          <Link href="/api/auth/oauth/google" prefetch={false} className={cn(buttonVariants({ variant: "outline" }), "h-12 rounded-2xl bg-card text-base")}>
            <GoogleMark />
            使用 Google 繼續
          </Link>
          <Link href="/api/auth/oauth/x" prefetch={false} className={cn(buttonVariants({ variant: "outline" }), "h-12 rounded-2xl bg-card text-base")}>
            <XMark />
            使用 X 繼續
          </Link>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          或以電郵{mode === "login" ? "登入" : "註冊"}
          <span className="h-px flex-1 bg-border" />
        </div>

        <form className="grid gap-4" onSubmit={submit} noValidate>
          {mode === "register" ? (
            <TextField
              id="displayName"
              name="displayName"
              label="顯示名稱"
              placeholder="例如：Alex"
              autoComplete="nickname"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              error={fields.displayName}
            />
          ) : null}
          <TextField
            id="email"
            name="email"
            type="email"
            label="電郵"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fields.email}
          />
          <TextField
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            label="密碼"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fields.password}
            hint="密碼至少 8 個字元。"
          />
          <button
            type="button"
            className="justify-self-start text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? "隱藏密碼" : "顯示密碼"}
          </button>
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" className="h-12 rounded-2xl text-base" disabled={pending}>
            {pending ? "處理中…" : mode === "login" ? "電郵登入" : "註冊並登入"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm">
          {mode === "login" ? (
            <>
              沒有帳號？{" "}
              <Link className="font-medium underline-offset-4 hover:underline" href={`/register?next=${encodeURIComponent(next)}`}>
                註冊
              </Link>
            </>
          ) : (
            <>
              已有帳號？{" "}
              <Link className="font-medium underline-offset-4 hover:underline" href={`/login?next=${encodeURIComponent(next)}`}>
                改為登入
              </Link>
            </>
          )}
        </p>

        {mode === "login" ? (
          <Card className="mt-8 rounded-3xl bg-accent/80 shadow-none ring-foreground/5">
            <CardHeader>
              <CardTitle>示範家庭</CardTitle>
              <CardDescription className="leading-6">
                不用設定 OAuth。Alex 與 May 已在同一個家庭，可以直接看帳本。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button type="button" className="h-12 rounded-2xl" onClick={() => void demo()} disabled={pending}>
                使用示範帳號登入
              </Button>
              <p className="text-xs leading-5 text-muted-foreground">
                Alex：{DEMO_EMAIL}
                <br />
                May：{DEMO_PARTNER_EMAIL}
                <br />
                密碼都是 {DEMO_PASSWORD}　邀請碼 {DEMO_INVITE_CODE}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8A6.4 6.4 0 1 1 12 5.6c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.7 3.1 14.6 2 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12Z" />
    </svg>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="currentColor" d="M14.7 10.3 21.4 3h-1.6l-5.8 6.4L9.3 3H3.4l7 9.8L3.4 21h1.6l6.2-6.9 4.9 6.9h5.9l-7.3-10.7Zm-2.2 2.4-.7-1L5.6 4.2h2.4l4.6 6.4.7 1 6 8.2h-2.4l-4.4-6.1Z" />
    </svg>
  );
}
