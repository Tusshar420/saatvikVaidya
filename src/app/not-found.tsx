import type { Metadata } from "next";
import { NotFoundScreen } from "@/components/not-found-screen";
import { Logo } from "@/components/site/logo";
import { notFoundScreen } from "@/content/errors";

export const metadata: Metadata = { title: notFoundScreen.metaTitle };

// An address that matches no page: the root layout only (no site header), so
// the logo is shown on its own, linking home.
export default function RootNotFound() {
  return (
    <>
      <header className="flex justify-center px-4 pt-8">
        <Logo />
      </header>
      <main id="main" className="flex flex-1 flex-col">
        <NotFoundScreen />
      </main>
    </>
  );
}
