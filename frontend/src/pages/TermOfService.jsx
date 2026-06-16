import React from 'react';

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <section className="bg-gradient-to-br from-emerald-900/30 to-gray-900 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Terms of Service</h1>
          <p className="text-gray-400">Last updated: June 15, 2026</p>
        </div>
      </section>

      <section className="py-16 px-6 max-w-4xl mx-auto">
        <div className="space-y-8 text-gray-300 leading-relaxed">
          
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p>By accessing or using TrustedHand (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Description of Service</h2>
            <p>TrustedHand is a marketplace platform that connects clients seeking skilled services with verified artisans across Nigeria.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. User Accounts</h2>
            <p className="mb-3">To use certain features of the Platform, you must register for an account. You agree to:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-400">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and promptly update your account information</li>
              <li>Keep your password secure and confidential</li>
              <li>Be responsible for all activities that occur under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Artisan Verification</h2>
            <p>Artisans must complete our verification process before offering services on the Platform. This includes identity verification, skill assessment, and background checks.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Payments & Fees</h2>
            <p className="mb-3">The Platform uses an escrow payment system. Key terms:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-400">
              <li>Clients pay the agreed service fee plus a 5% platform service fee</li>
              <li>Artisans receive payment minus a 10% platform commission</li>
              <li>Funds are held in escrow until the client confirms job completion</li>
              <li>Disputes must be filed within 7 days of job completion</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Prohibited Activities</h2>
            <p className="mb-3">Users may not:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-400">
              <li>Use the Platform for any illegal purpose</li>
              <li>Post false, misleading, or fraudulent content</li>
              <li>Attempt to circumvent the Platform&apos;s payment system</li>
              <li>Harass, abuse, or discriminate against other users</li>
              <li>Share contact information to transact outside the Platform</li>
              <li>Create multiple accounts or use fake identities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Dispute Resolution</h2>
            <p>In the event of a dispute between users, TrustedHand will act as a mediator. Both parties agree to cooperate with our investigation and accept our final decision.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Limitation of Liability</h2>
            <p>TrustedHand is a marketplace facilitator and is not liable for the quality of work performed by artisans, damages resulting from services, or disputes between users.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Termination</h2>
            <p>We may terminate or suspend your account immediately, without prior notice or liability, for any reason, including breach of these Terms.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Changes to Terms</h2>
            <p>We reserve the right to modify these terms at any time. We will provide notice of significant changes by posting the new terms on the Platform.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Contact Us</h2>
            <p>If you have any questions about these Terms, please contact us at <span className="text-emerald-400">Trustedhand100@gmail.com</span> or call <span className="text-emerald-400">+234 8089659183</span>.</p>
          </section>

        </div>
      </section>
    </div>
  );
};

export default TermsOfService;