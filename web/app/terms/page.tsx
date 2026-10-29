import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal";

export const metadata: Metadata = { title: "Terms of use | LuxeBeau" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="29 October 2026">
      <section>
        <h2>What LuxeBeau is</h2>
        <p>
          LuxeBeau is an online marketplace. It connects buyers with independent sellers of beauty products and with
          independent artisans (braiders, barbers, makeup artists and similar). The seller or artisan, not LuxeBeau, provides
          the product or the service.
        </p>
      </section>
      <section>
        <h2>Your account</h2>
        <ul>
          <li>Give accurate details and keep your password private. You are responsible for what happens on your account.</li>
          <li>Sellers and artisans may be asked to verify their business or identity before they can sell or take bookings.</li>
        </ul>
      </section>
      <section>
        <h2>Buying and escrow</h2>
        <ul>
          <li>When you pay for an order, the money is held in escrow. It is not paid to the seller straight away.</li>
          <li>The money is released to the seller when you confirm delivery, or automatically after the release date shown on your order if you do nothing.</li>
          <li>If something is wrong, raise a dispute before the release date. See Buyer protection for how that works.</li>
        </ul>
      </section>
      <section>
        <h2>Bookings</h2>
        <p>
          Each artisan sets a cancellation window, shown to you when you book. Cancelling inside that window, or not turning
          up, may be recorded against your account and can affect refunds.
        </p>
      </section>
      <section>
        <h2>Sellers and artisans</h2>
        <ul>
          <li>List only genuine items and services you are allowed to sell, described honestly, with true prices and stock.</li>
          <li>Deliver or perform what you listed. Counterfeit, stolen or illegal goods are not allowed and will be removed.</li>
          <li>Fees, where they apply, are shown before you confirm and are taken from what you are paid.</li>
        </ul>
      </section>
      <section>
        <h2>Things we may do</h2>
        <p>
          We may suspend accounts, remove listings or hold payments while we look into suspected fraud, abuse or a
          dispute. We try to keep the service running but cannot promise it will always be available.
        </p>
      </section>
      <section>
        <h2>Changes and questions</h2>
        <p>
          We may update these terms and will change the date above when we do. Support contact details will be published on
          this page before launch.
        </p>
      </section>
    </LegalPage>
  );
}
