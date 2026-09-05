import {
  Boxes,
  Images,
  LayoutDashboard,
  LibraryBig,
  NotebookPen,
  ScanFace,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { RefObject } from "react";

import {
  isNavigationItemActive,
  navigationItems,
  type NavigationIconName,
} from "@/components/layout/navigation";
import { cn } from "@/lib/utils";

const icons: Record<NavigationIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  studio: Sparkles,
  products: Boxes,
  models: ScanFace,
  generations: LibraryBig,
  media: Images,
  presets: SlidersHorizontal,
  posts: NotebookPen,
};

type SidebarProps = {
  pathname: string;
  onNavigate?: () => void;
  className?: string;
  focusTargetRef?: RefObject<HTMLAnchorElement | null>;
};

export function Sidebar({
  pathname,
  onNavigate,
  className,
  focusTargetRef,
}: SidebarProps) {
  const focusTarget =
    navigationItems.find((item) =>
      isNavigationItemActive(item.href, pathname),
    ) ?? navigationItems[0];

  return (
    <aside
      className={cn(
        "border-border bg-card flex h-full w-full flex-col border-r",
        className,
      )}
    >
      <div className="border-border flex h-20 items-center border-b px-6">
        <Link
          href="/"
          className="focus-visible:ring-ring rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          onClick={onNavigate}
        >
          <span className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
            Private studio
          </span>
          <span className="mt-1 block text-lg font-semibold tracking-tight">
            AI Fashion
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Workspace">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = icons[item.icon];
            const active = isNavigationItemActive(item.href, pathname);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  ref={item === focusTarget ? focusTargetRef : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={cn(
                    "group focus-visible:ring-ring flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 font-medium">
                    {item.label}
                  </span>
                  {item.availability === "planned" ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[0.625rem] font-semibold tracking-wide uppercase",
                        active
                          ? "bg-primary-foreground/15 text-primary-foreground"
                          : "bg-muted text-muted-foreground group-hover:bg-background",
                      )}
                    >
                      Soon
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-border border-t px-6 py-5">
        <p className="text-muted-foreground text-xs leading-5">
          A focused workspace for campaign-ready fashion imagery.
        </p>
      </div>
    </aside>
  );
}
