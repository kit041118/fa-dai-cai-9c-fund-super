import { cn } from "cn";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "size-14" : size === "sm" ? "size-9" : "size-11";
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("grid shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground", box)} aria-hidden>
        <svg viewBox="0 0 32 32" className="size-[62%]">
          <circle cx="16" cy="17" r="8" fill="none" stroke="#E7C98A" strokeWidth="1.7" />
          <path d="M16 21.5V14" stroke="#E7C98A" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M16 14c1.6-2.4 3.6-3.4 3.6-3.4" stroke="#E7C98A" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M16 15.2c-1.8-1.6-3.8-1.5-3.8-1.5" stroke="#E7C98A" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block font-heading text-[15px] font-semibold tracking-wide text-foreground">發大財家庭基金</span>
        <span className="block text-[10px] font-medium tracking-[0.22em] text-muted-foreground">9F MONEY</span>
      </span>
    </div>
  );
}
