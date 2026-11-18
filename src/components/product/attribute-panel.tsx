"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import type { AttributeGroup, AttributeIcon } from "@/lib/product-attributes";
import { cn } from "@/lib/utils";
import {
  ChevronDownIcon,
  FileDownIcon,
  FileTextIcon,
  GridIcon,
  LayersIcon,
  PlayIcon,
  PuzzleIcon,
  RulerIcon,
  SheetIcon,
  ShieldCheckIcon,
  TagIcon,
  XIcon,
} from "../ui/icons";

const ICONS: Record<AttributeIcon, (size: number) => ReactNode> = {
  identity: (s) => <TagIcon size={s} />,
  overview: (s) => <FileTextIcon size={s} />,
  media: (s) => <PlayIcon size={s} />,
  specs: (s) => <RulerIcon size={s} />,
  certifications: (s) => <ShieldCheckIcon size={s} />,
  documents: (s) => <FileDownIcon size={s} />,
  variants: (s) => <LayersIcon size={s} />,
  related: (s) => <GridIcon size={s} />,
  compatible: (s) => <PuzzleIcon size={s} />,
};

/** Smooth-scrolls to an element, then plays the highlight animation once it has arrived. */
function revealTarget(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const small = el.getBoundingClientRect().height < window.innerHeight * 0.4;
  el.scrollIntoView({ behavior: "smooth", block: small ? "center" : "start" });

  let done = false;
  const flash = () => {
    if (done) return;
    done = true;
    window.removeEventListener("scrollend", flash);
    el.classList.remove("attr-flash");
    void el.offsetWidth; // restart the animation when the same item is clicked twice
    el.classList.add("attr-flash");
    el.addEventListener("animationend", () => el.classList.remove("attr-flash"), { once: true });
  };
  window.addEventListener("scrollend", flash, { once: true });
  // Browsers without `scrollend`, or no scroll needed because the element is already in view.
  window.setTimeout(flash, 900);
}

/** Highlights the group whose section is currently on screen. */
function useActiveGroup(groups: AttributeGroup[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const byTarget = new Map(groups.map((g) => [g.target, g.key]));
    const targets = groups.map((g) => document.getElementById(g.target)).filter((el): el is HTMLElement => !!el);
    if (!targets.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(byTarget.get(visible[0].target.id) ?? null);
      },
      { rootMargin: "-140px 0px -55% 0px", threshold: 0 },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [groups]);
  return active;
}

function Group({
  group,
  active,
  onPick,
}: {
  group: AttributeGroup;
  active: boolean;
  onPick: (target: string) => void;
}) {
  const [open, setOpen] = useState(group.key === "specs" || group.key === "identity");
  const listId = useId();
  const expandable = group.items.length > 0;
  const empty = group.count === 0;

  return (
    <li>
      <div
        className={cn(
          "group/row flex items-center rounded-xl transition-colors",
          active ? "bg-primary-soft text-primary" : "text-foreground hover:bg-muted",
          empty && "opacity-60",
        )}
      >
        <button
          type="button"
          onClick={() => onPick(group.target)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
        >
          <span className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground group-hover/row:text-foreground")}>{ICONS[group.icon](16)}</span>
          <span className="min-w-0 flex-1 truncate">{group.label}</span>
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums",
              active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover/row:bg-background",
            )}
          >
            {group.count}
          </span>
        </button>
        {expandable && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={listId}
            aria-label={`${open ? "Hide" : "Show"} ${group.label} attributes`}
            className="mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDownIcon size={14} className={cn("transition-transform duration-200", open && "rotate-180")} />
          </button>
        )}
      </div>
      {expandable && (
        <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <ul id={listId} className="ml-[19px] min-h-0 overflow-hidden border-l" inert={!open}>
            {group.items.map((item) => (
              <li key={`${item.target}-${item.label}`}>
                <button
                  type="button"
                  onClick={() => onPick(item.target)}
                  title={item.value ? `${item.label}: ${item.value}` : item.label}
                  className="-ml-px flex w-full items-baseline gap-2 border-l border-transparent py-1.5 pl-3 pr-2 text-left text-xs outline-none transition-colors hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:text-foreground"
                >
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.label}</span>
                  {item.value && <span className="max-w-[45%] shrink-0 truncate font-medium text-foreground/80">{item.value}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

interface PanelText {
  /** Small heading above the number, e.g. "From inRiver". */
  heading?: string;
  /** Words after the number, e.g. "attributes imported". */
  totalLabel?: string;
  /** Extra content under the list (the legacy site's "not shown" summary). */
  extra?: ReactNode;
}

function PanelBody({
  groups,
  total,
  source,
  active,
  onPick,
  heading = "From inRiver",
  totalLabel = "attributes imported",
  extra,
}: {
  groups: AttributeGroup[];
  total: number;
  source: string | null;
  active: string | null;
  onPick: (target: string) => void;
} & PanelText) {
  return (
    <>
      <div className="border-b px-4 pb-4 pt-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          <SheetIcon size={13} /> {heading}
        </p>
        <p className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{total}</span>
          <span className="text-sm text-muted-foreground">{totalLabel}</span>
        </p>
        {source && (
          <p className="mt-1.5 truncate text-[11px] text-muted-foreground" title={source}>
            {source}
          </p>
        )}
      </div>
      <nav aria-label="Imported attributes" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        <ul className="space-y-0.5">
          {groups.map((g) => (
            <Group key={g.key} group={g} active={active === g.key} onPick={onPick} />
          ))}
        </ul>
        {extra}
      </nav>
      <p className="border-t px-4 py-2.5 text-[11px] leading-snug text-muted-foreground">Click an attribute to jump to it on the page.</p>
    </>
  );
}

/**
 * "From inRiver" navigator: lists every attribute imported for this part with counts.
 * Clicking one scrolls to it and highlights it. A sticky side rail on wide screens,
 * a floating button with a pop-up sheet on smaller ones.
 */
export function AttributePanel({
  groups,
  total,
  source,
  ...text
}: { groups: AttributeGroup[]; total: number; source: string | null } & PanelText) {
  const active = useActiveGroup(groups);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const pick = (target: string) => {
    setSheetOpen(false);
    revealTarget(target);
  };

  return (
    <>
      {/* Wide screens: sticky rail beside the page. */}
      <div className="animate-rise sticky top-[calc(var(--header-height)+1.25rem)] hidden max-h-[calc(100vh-var(--header-height)-2.5rem)] flex-col overflow-hidden rounded-3xl border bg-card shadow-[0_24px_48px_-36px_rgb(15_23_42/0.45)] xl:flex">
        <PanelBody groups={groups} total={total} source={source} active={active} onPick={pick} {...text} />
      </div>

      {/* Smaller screens: floating button + pop-up sheet. */}
      <div className="xl:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen((v) => !v)}
          aria-expanded={sheetOpen}
          className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-full border bg-card/95 py-2 pl-3 pr-3.5 text-sm font-medium text-foreground shadow-lg backdrop-blur transition-transform active:scale-95 sm:bottom-6 sm:left-6"
        >
          <SheetIcon size={16} className="text-primary" /> inRiver data
          <span className="rounded-full bg-primary px-1.5 py-px text-[11px] font-semibold tabular-nums text-primary-foreground">{total}</span>
        </button>
        {sheetOpen && (
          <>
            <div className="animate-fade fixed inset-0 z-40 bg-foreground/10" onClick={() => setSheetOpen(false)} aria-hidden="true" />
            <div
              role="dialog"
              aria-label="Imported attributes"
              className="attr-sheet-in fixed bottom-20 left-4 z-50 flex max-h-[70vh] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl sm:bottom-24 sm:left-6"
            >
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <XIcon size={16} />
              </button>
              <PanelBody groups={groups} total={total} source={source} active={active} onPick={pick} {...text} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
