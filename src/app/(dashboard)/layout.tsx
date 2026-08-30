import { requireDashboardUser } from "@/app/(dashboard)/guard";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ownerId = await requireDashboardUser();

  return <AppShell ownerId={ownerId}>{children}</AppShell>;
}
