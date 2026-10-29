import SiteShell, { Container } from "@/components/site/shell";

/* Shared frame for the plain-language policy pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <SiteShell>
      <Container className="max-w-[820px] pb-10 pt-8 md:pt-12">
        <h1 className="text-[36px] font-extrabold tracking-[-0.045em] sm:text-[44px]">{title}</h1>
        <p className="mt-2 text-[13px] text-muted">Last updated {updated}</p>
        <p className="mt-5 rounded-2xl bg-brand-wash p-4 text-[14px] leading-relaxed text-brand-deep">
          This is a plain-language summary of how LuxeBeau works today. It is not legal advice, and a fuller version will
          replace it. Nothing here limits any right you have under Nigerian law.
        </p>
        <div className="mt-6 space-y-7 text-[15px] leading-relaxed text-ink/85 [&_h2]:mb-2 [&_h2]:text-[20px] [&_h2]:font-bold [&_h2]:tracking-[-0.03em] [&_h2]:text-ink [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </Container>
    </SiteShell>
  );
}
