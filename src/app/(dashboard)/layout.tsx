import { requireDashboardUser } from "@/app/(dashboard)/guard";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireDashboardUser();

  return children;
}
