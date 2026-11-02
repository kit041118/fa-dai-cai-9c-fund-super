"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageIntro, TextField } from "@/components/ui-bits";
import { useFund } from "@/components/fund-provider";
import { CONCERT_STATUS_LABEL } from "@/lib/constants";
import { api } from "@/lib/api";
import { formatLongDate, hkToday } from "@/lib/format";
import type { ConcertStatus, Recipe } from "@/lib/types";

export function LifeView() {
  const fund = useFund();
  const today = hkToday();

  return (
    <div>
      <PageIntro
        title="生活百科"
        subtitle="演唱會清單是示範資料，日後可接上自動更新。食譜則由這個家庭一起維護。"
      />
      <Tabs defaultValue="concerts">
        <TabsList className="grid h-12 w-full grid-cols-2 rounded-2xl bg-card p-1">
          <TabsTrigger value="concerts" className="h-10 rounded-xl">
            演唱會
          </TabsTrigger>
          <TabsTrigger value="recipes" className="h-10 rounded-xl">
            家居食譜
          </TabsTrigger>
        </TabsList>
        <TabsContent value="concerts" className="mt-4 grid gap-3">
          <p className="text-sm leading-6 text-muted-foreground">
            以下為香港熱門演出的示範清單，狀態只供參考，並非即時票務。
          </p>
          {fund.concerts.map((concert) => (
            <article key={concert.id} className="rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{formatLongDate(concert.eventDate)}</p>
                  <h2 className="mt-1 font-heading text-xl font-semibold">{concert.artist}</h2>
                  <p className="text-sm">{concert.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{concert.venue}</p>
                </div>
                <StatusPill status={concert.status} />
              </div>
            </article>
          ))}
        </TabsContent>
        <TabsContent value="recipes" className="mt-4 grid gap-4">
          <RecipeForm onSaved={() => void fund.refresh()} />
          {fund.recipes.length === 0 ? (
            <p className="rounded-3xl bg-card p-5 text-sm text-muted-foreground ring-1 ring-foreground/10">
              還沒有食譜。把今晚想煮的菜加進來。
            </p>
          ) : null}
          {fund.recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              today={today}
              onCooked={(cookedOn) => void cook(fund.markCooked, recipe.id, cookedOn)}
              onDelete={() => void removeRecipe(recipe.id, fund.refresh)}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusPill({ status }: { status: ConcertStatus }) {
  const className =
    status === "on_sale"
      ? "bg-sage text-sage-ink"
      : status === "sold_out"
        ? "bg-destructive/10 text-destructive"
        : status === "upcoming"
          ? "bg-gold-soft text-foreground"
          : "bg-secondary text-muted-foreground";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{CONCERT_STATUS_LABEL[status]}</span>;
}

async function cook(
  markCooked: (id: string, cookedOn: string | null) => Promise<{ ok: boolean; error?: string; pending?: boolean }>,
  id: string,
  cookedOn: string | null,
) {
  const result = await markCooked(id, cookedOn);
  if (!result.ok) {
    toast.error(result.error || "未能更新");
    return;
  }
  toast.success(result.pending ? "已暫存，連線後同步" : cookedOn ? "已記今日煮過" : "已取消今日紀錄");
}

async function removeRecipe(id: string, refresh: () => Promise<void>) {
  if (!navigator.onLine) {
    toast.error("請先連線再刪除食譜");
    return;
  }
  const result = await api(`/api/recipes/${id}`, { method: "DELETE" });
  if (!result.ok) {
    toast.error(result.error);
    return;
  }
  toast.success("已刪除食譜");
  await refresh();
}

function RecipeCard({
  recipe,
  today,
  onCooked,
  onDelete,
}: {
  recipe: Recipe;
  today: string;
  onCooked: (cookedOn: string | null) => void;
  onDelete: () => void;
}) {
  const cookedToday = recipe.lastCookedOn === today;
  const [broken, setBroken] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <article className="overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10">
      {recipe.photoUrl && !broken ? (
        // User-provided URLs are arbitrary; next/image would need a remote allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={recipe.photoUrl} alt="" className="h-40 w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <div className="grid h-28 place-items-center bg-accent font-heading text-xl">{recipe.title}</div>
      )}
      <div className="grid gap-3 p-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">{recipe.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {recipe.servings} 人份
            {recipe.lastCookedOn ? ` · 上次煮 ${formatLongDate(recipe.lastCookedOn)}` : ""}
            {recipe.pending ? " · 離線暫存" : ""}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium">材料</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm leading-6">
            {recipe.ingredients.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium">步驟</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-6">
            {recipe.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <Button type="button" className="h-11 rounded-2xl" disabled={cookedToday} onClick={() => onCooked(today)}>
          {cookedToday ? "今日已煮過" : "記今日煮過"}
        </Button>
        {cookedToday ? (
          <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => onCooked(null)}>
            取消今日紀錄
          </button>
        ) : null}
        <button type="button" className="justify-self-start text-sm text-destructive" onClick={() => setConfirming(true)}>
          刪除食譜
        </button>
      </div>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>刪除「{recipe.title}」？</DialogTitle>
            <DialogDescription>食譜會從家庭清單移除。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-0 bg-transparent">
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function RecipeForm({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [servings, setServings] = useState("2");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!navigator.onLine) {
      toast.error("請先連線再新增食譜");
      return;
    }
    setSaving(true);
    const result = await api("/api/recipes", {
      method: "POST",
      body: JSON.stringify({
        title,
        photoUrl,
        servings: Number(servings),
        ingredients: ingredients.split(/\n/).map((line) => line.trim()).filter(Boolean),
        steps: steps.split(/\n/).map((line) => line.trim()).filter(Boolean),
      }),
    });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.fields ?? {});
      toast.error(result.error);
      return;
    }
    setOpen(false);
    setTitle("");
    setPhotoUrl("");
    setIngredients("");
    setSteps("");
    setErrors({});
    toast.success("已加入食譜");
    onSaved();
  }

  return (
    <>
      <Button type="button" className="h-12 rounded-2xl" onClick={() => setOpen(true)}>
        新增食譜
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增食譜</DialogTitle>
            <DialogDescription>材料與步驟各佔一行。相片網址可以留空。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <TextField id="recipe-title" label="名稱" value={title} onChange={(event) => setTitle(event.target.value)} error={errors.title} />
            <TextField id="recipe-photo" label="相片網址" value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} error={errors.photoUrl} placeholder="https://" />
            <TextField id="recipe-servings" label="份量" inputMode="numeric" value={servings} onChange={(event) => setServings(event.target.value)} error={errors.servings} />
            <label className="grid gap-1.5 text-sm font-medium">
              材料
              <Textarea value={ingredients} onChange={(event) => setIngredients(event.target.value)} className="min-h-24 rounded-2xl bg-card px-3 py-2 text-base" placeholder={"雞蛋 3 隻\n番茄 2 個"} />
              {errors.ingredients ? <span className="font-normal text-destructive">{errors.ingredients}</span> : null}
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              步驟
              <Textarea value={steps} onChange={(event) => setSteps(event.target.value)} className="min-h-24 rounded-2xl bg-card px-3 py-2 text-base" placeholder={"番茄切件。\n蛋先炒至剛凝固。"} />
              {errors.steps ? <span className="font-normal text-destructive">{errors.steps}</span> : null}
            </label>
          </div>
          <DialogFooter className="border-0 bg-transparent">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "儲存中…" : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
