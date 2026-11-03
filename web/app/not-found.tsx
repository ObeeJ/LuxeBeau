import Link from "next/link";
import { LuxeBeauMark } from "@/components/site/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 text-center bg-canvas">
      <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-brand shadow-glow mb-6">
        <LuxeBeauMark size={52} className="text-surface" />
      </div>

      <span className="text-[12px] font-bold tracking-widest text-brand uppercase">
        404 — Page Not Found
      </span>

      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
        Looking for beauty in the wrong place?
      </h1>

      <p className="mt-3 max-w-md text-sm text-muted leading-relaxed">
        The page you are looking for doesn't exist, has moved, or was typed incorrectly. All transactions and funds remain completely safe in escrow.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="rounded-full bg-brand text-surface hover:bg-brand-deep px-6">
          <Link href="/">Back to Home</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full px-6">
          <Link href="/shop">Browse Marketplace</Link>
        </Button>
        <Button asChild variant="secondary" className="rounded-full px-6">
          <Link href="/services">Book Beauty Artisans</Link>
        </Button>
      </div>
    </div>
  );
}
