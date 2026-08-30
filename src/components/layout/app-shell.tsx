"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

type AppShellProps = {
  children: React.ReactNode;
  ownerId: string;
};

export function AppShell({ children, ownerId }: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const desktopNavigationFocusRef = useRef<HTMLAnchorElement>(null);
  const closeMobileNavigation = useCallback(
    () => setMobileNavigationOpen(false),
    [],
  );

  useEffect(() => {
    const desktopViewport = window.matchMedia("(min-width: 64rem)");

    function closeAtDesktop(event: MediaQueryListEvent) {
      if (event.matches && mobileNavigationOpen) {
        setMobileNavigationOpen(false);
        desktopNavigationFocusRef.current?.focus();
      }
    }

    desktopViewport.addEventListener("change", closeAtDesktop);

    return () => {
      desktopViewport.removeEventListener("change", closeAtDesktop);
    };
  }, [mobileNavigationOpen]);

  return (
    <div className="bg-background min-h-screen">
      <Sidebar
        pathname={pathname}
        focusTargetRef={desktopNavigationFocusRef}
        className="fixed inset-y-0 left-0 z-30 hidden w-70 lg:flex"
      />
      <div className="min-h-screen lg:pl-70">
        <TopBar
          ownerId={ownerId}
          menuButtonRef={menuButtonRef}
          mobileNavigationOpen={mobileNavigationOpen}
          onOpenNavigation={() => setMobileNavigationOpen(true)}
        />
        <div className="min-w-0">{children}</div>
      </div>
      <MobileNav
        open={mobileNavigationOpen}
        pathname={pathname}
        onClose={closeMobileNavigation}
        returnFocusRef={menuButtonRef}
      />
    </div>
  );
}
