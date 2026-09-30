import { requireAdmin } from "@/server/auth/session";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Admin Panel · Saatvik Vaidya",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-line bg-white sticky top-0 z-50">
        <div className="shell flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="font-semibold text-lg">
              Admin Panel
            </Link>
            <nav className="flex gap-6">
              <Link href="/admin" className="text-sm hover:text-teal">
                Database
              </Link>
            </nav>
          </div>
          <form
            action="/api/auth/sign-out"
            method="POST"
            className="flex items-center gap-2"
          >
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              icon="end"
              className="gap-2"
            >
              Sign Out
              <LogOut className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </header>
      <main className="shell py-8">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
