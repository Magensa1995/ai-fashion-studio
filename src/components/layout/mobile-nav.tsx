import { X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";

type MobileNavProps = {
  open: boolean;
  pathname: string;
  onClose: () => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
};

const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileNav({
  open,
  pathname,
  onClose,
  returnFocusRef,
}: MobileNavProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeAndRestoreFocus = useCallback(() => {
    onClose();
    returnFocusRef.current?.focus();
  }, [onClose, returnFocusRef]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRestoreFocus();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      const first = focusable[0];
      const last = focusable.at(-1);

      if (!first || !last) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeAndRestoreFocus, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 lg:hidden"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeAndRestoreFocus();
        }
      }}
    >
      <div
        id="mobile-navigation-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-navigation-title"
        className="bg-card h-full w-[min(22rem,88vw)] shadow-2xl"
      >
        <h2 id="mobile-navigation-title" className="sr-only">
          Workspace navigation
        </h2>
        <Button
          ref={closeButtonRef}
          type="button"
          variant="outline"
          size="icon"
          className="absolute top-5 left-[min(calc(22rem-3.5rem),calc(88vw-3.5rem))] z-10"
          aria-label="Close navigation"
          onClick={closeAndRestoreFocus}
        >
          <X aria-hidden="true" />
        </Button>
        <Sidebar pathname={pathname} onNavigate={closeAndRestoreFocus} />
      </div>
    </div>
  );
}
