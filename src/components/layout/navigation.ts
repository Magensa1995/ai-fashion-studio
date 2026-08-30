export type NavigationItem = {
  label: string;
  href: string;
  segment: string | null;
  description: string;
  icon: NavigationIconName;
  availability: "available" | "planned";
};

export type NavigationIconName =
  | "dashboard"
  | "studio"
  | "products"
  | "models"
  | "generations"
  | "media"
  | "presets"
  | "posts";

export const navigationItems: readonly NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/",
    segment: null,
    description: "Workspace overview",
    icon: "dashboard",
    availability: "available",
  },
  {
    label: "Studio",
    href: "/studio",
    segment: "studio",
    description: "Compose image workflows",
    icon: "studio",
    availability: "planned",
  },
  {
    label: "Products",
    href: "/products",
    segment: "products",
    description: "Organize garment references",
    icon: "products",
    availability: "planned",
  },
  {
    label: "Models",
    href: "/models",
    segment: "models",
    description: "Manage model profiles",
    icon: "models",
    availability: "planned",
  },
  {
    label: "Generations",
    href: "/generations",
    segment: "generations",
    description: "Review generation history",
    icon: "generations",
    availability: "planned",
  },
  {
    label: "Media",
    href: "/media",
    segment: "media",
    description: "Browse creative assets",
    icon: "media",
    availability: "planned",
  },
  {
    label: "Presets",
    href: "/presets",
    segment: "presets",
    description: "Reuse creative direction",
    icon: "presets",
    availability: "planned",
  },
  {
    label: "Posts",
    href: "/posts",
    segment: "posts",
    description: "Prepare campaign copy",
    icon: "posts",
    availability: "planned",
  },
] as const;

export function isNavigationItemActive(href: string, pathname: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavigationItem(segment: string) {
  return navigationItems.find((item) => item.segment === segment);
}
