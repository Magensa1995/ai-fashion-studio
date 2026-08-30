import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

import { AppShell } from "@/components/layout/app-shell";

describe("AppShell", () => {
  const desktopMediaListeners = new Set<(event: MediaQueryListEvent) => void>();

  beforeEach(() => {
    usePathnameMock.mockReturnValue("/products");
    document.body.style.overflow = "";
    desktopMediaListeners.clear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(
        (query: string) =>
          ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: (
              type: string,
              listener: (event: MediaQueryListEvent) => void,
            ) => {
              if (type === "change") {
                desktopMediaListeners.add(listener);
              }
            },
            removeEventListener: (
              type: string,
              listener: (event: MediaQueryListEvent) => void,
            ) => {
              if (type === "change") {
                desktopMediaListeners.delete(listener);
              }
            },
          }) as MediaQueryList,
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.body.style.overflow = "";
  });

  it("renders shared desktop navigation, owner context, and an active link", () => {
    render(
      <AppShell ownerId="owner-12345678">
        <h1>Products workspace</h1>
      </AppShell>,
    );

    expect(
      screen.getByRole("navigation", { name: "Workspace" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Products/ })[0],
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("owner-1234")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Products workspace" }),
    ).toBeInTheDocument();
  });

  it("opens the mobile menu and places focus inside it", () => {
    render(
      <AppShell ownerId="owner-12345678">
        <p>Workspace</p>
      </AppShell>,
    );

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Workspace navigation" });
    expect(dialog).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", dialog.id);
    expect(
      screen.getByRole("button", { name: "Close navigation" }),
    ).toHaveFocus();
  });

  it("closes the mobile menu with Escape and returns focus to its trigger", () => {
    render(
      <AppShell ownerId="owner-12345678">
        <p>Workspace</p>
      </AppShell>,
    );

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes the mobile menu with its visible close control", () => {
    render(
      <AppShell ownerId="owner-12345678">
        <p>Workspace</p>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the mobile menu from its backdrop and returns focus", () => {
    render(
      <AppShell ownerId="owner-12345678">
        <p>Workspace</p>
      </AppShell>,
    );

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");

    fireEvent.click(dialog.parentElement!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps the mobile menu open when a click starts inside its panel", () => {
    render(
      <AppShell ownerId="owner-12345678">
        <p>Workspace</p>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const dialog = screen.getByRole("dialog");

    fireEvent.click(dialog);

    expect(dialog).toBeInTheDocument();
  });

  it("keeps keyboard focus inside the open mobile menu", () => {
    render(
      <AppShell ownerId="owner-12345678">
        <p>Workspace</p>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const dialog = screen.getByRole("dialog");
    const closeButton = screen.getByRole("button", {
      name: "Close navigation",
    });
    const lastLink = within(dialog).getByRole("link", { name: /Posts/ });

    closeButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(lastLink).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(closeButton).toHaveFocus();
  });

  it("closes the mobile menu after choosing a destination", () => {
    render(
      <AppShell ownerId="owner-12345678">
        <p>Workspace</p>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const dialog = screen.getByRole("dialog");
    const destination = within(dialog).getByRole("link", { name: /Products/ });
    destination.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(destination);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("releases the mobile dialog when the viewport crosses to desktop", () => {
    const { unmount } = render(
      <AppShell ownerId="owner-12345678">
        <button type="button">Workspace focus target</button>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.body).toHaveStyle({ overflow: "hidden" });
    const closeButton = screen.getByRole("button", {
      name: "Close navigation",
    });
    expect(closeButton).toHaveFocus();

    act(() => {
      for (const listener of desktopMediaListeners) {
        listener({
          matches: true,
          media: "(min-width: 64rem)",
        } as MediaQueryListEvent);
      }
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(closeButton).not.toHaveFocus();
    const desktopProductsLink = screen.getAllByRole("link", {
      name: /Products/,
    })[0];
    expect(desktopProductsLink).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(desktopProductsLink).toHaveFocus();

    unmount();
    expect(desktopMediaListeners).toHaveLength(0);
  });

  it("does not restore focus to shell controls while the shell unmounts", () => {
    const { unmount } = render(
      <AppShell ownerId="owner-12345678">
        <p>Workspace</p>
      </AppShell>,
    );

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(trigger);
    expect(
      screen.getByRole("button", { name: "Close navigation" }),
    ).toHaveFocus();

    unmount();

    expect(trigger.isConnected).toBe(false);
    expect(document.activeElement).toBe(document.body);
    expect(desktopMediaListeners).toHaveLength(0);
  });
});
