import { LogOut, Menu } from "lucide-react";
import type { RefObject } from "react";

import { logout } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";

type TopBarProps = {
  ownerId: string;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  mobileNavigationOpen: boolean;
  onOpenNavigation: () => void;
};

export function TopBar({
  ownerId,
  menuButtonRef,
  mobileNavigationOpen,
  onOpenNavigation,
}: TopBarProps) {
  const ownerLabel = ownerId.slice(0, 10);

  return (
    <header className="border-border bg-background/90 sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 backdrop-blur sm:px-6 lg:px-8">
      <Button
        ref={menuButtonRef}
        type="button"
        variant="outline"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        aria-haspopup="dialog"
        aria-expanded={mobileNavigationOpen}
        aria-controls="mobile-navigation-dialog"
        onClick={onOpenNavigation}
      >
        <Menu aria-hidden="true" />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">Creative workspace</p>
        <p className="text-muted-foreground truncate text-xs">
          Signed in as <span className="font-mono">{ownerLabel}</span>
        </p>
      </div>

      <form action={logout}>
        <Button type="submit" variant="ghost" size="sm">
          <LogOut aria-hidden="true" />
          <span className="hidden sm:inline">Sign out</span>
          <span className="sr-only sm:hidden">Sign out</span>
        </Button>
      </form>
    </header>
  );
}
