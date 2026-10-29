import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal";

export const metadata: Metadata = { title: "Buyer protection | LuxeBeau" };

export default function BuyerProtectionPage() {
  return (
    <LegalPage title="Buyer protection" updated="29 October 2026">
      <section>
        <h2>How escrow works</h2>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>You pay for your order. The money is held, not sent to the seller.</li>
          <li>The seller prepares and delivers your order and marks it as delivered.</li>
          <li>You check it and confirm. The seller is then paid.</li>
          <li>If you do nothing, the money is released automatically on the release date shown on your order.</li>
        </ol>
      </section>
      <section>
        <h2>If something is wrong</h2>
        <p>
          If your order does not arrive, or is not what the seller described, raise a dispute from your order before the
          release date. The money stays held while we look into it. We review what the buyer and the seller tell us and then
          either release the money to the seller or refund you.
        </p>
      </section>
      <section>
        <h2>What helps your case</h2>
        <ul>
          <li>Clear photos of what you received and its packaging.</li>
          <li>The order number and the seller listing you bought from.</li>
          <li>Messages between you and the seller.</li>
        </ul>
      </section>
      <section>
        <h2>What this does not cover</h2>
        <ul>
          <li>Payments made outside LuxeBeau, for example by bank transfer to a seller directly.</li>
          <li>Disputes raised after the money has been released.</li>
        </ul>
      </section>
      <section>
        <h2>No promises about the outcome</h2>
        <p>
          Every dispute is decided on its own facts. We aim to be fair to both sides, but we cannot promise a particular result.
        </p>
      </section>
    </LegalPage>
  );
}
