import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal";

export const metadata: Metadata = { title: "Privacy | LuxeBeau" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="29 October 2026">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Your name, email address and phone number when you sign up.</li>
          <li>Delivery address and phone number when you place an order.</li>
          <li>Your orders, bookings and messages about disputes.</li>
          <li>If you choose to verify your identity: the ID number you submit (for example NIN or BVN) and the result of the check.</li>
          <li>Photos that sellers and artisans upload for their listings.</li>
        </ul>
      </section>
      <section>
        <h2>How we use it</h2>
        <p>
          To run your account, take and deliver orders, hold and release payments, handle bookings and disputes, prevent
          fraud, and contact you about your orders. We do not sell your personal information.
        </p>
      </section>
      <section>
        <h2>Who else sees it</h2>
        <ul>
          <li>The seller or artisan you buy from sees the name, phone number and address they need to deliver or serve you.</li>
          <li>Payment providers process your payment. We do not store your full card details.</li>
          <li>An identity-check provider receives the ID number you choose to submit for verification.</li>
          <li>Services we rely on to send email and host images process data on our behalf.</li>
        </ul>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>
          We use cookies to keep you signed in and to help protect against forged requests. They are needed for the site to
          work while you are signed in.
        </p>
      </section>
      <section>
        <h2>Keeping it safe</h2>
        <p>
          Passwords are stored in scrambled (hashed) form and sessions use protected cookies. No system is perfectly secure,
          so use a strong password that you do not reuse elsewhere.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You can ask us to correct or delete your information. We may need to keep some records, such as orders and
          disputes, for as long as they are needed to settle claims or meet legal duties. Support contact details will be
          published on this page before launch.
        </p>
      </section>
    </LegalPage>
  );
}
