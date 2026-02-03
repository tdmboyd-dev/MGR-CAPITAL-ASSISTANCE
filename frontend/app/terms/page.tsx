"use client";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: February 2, 2026</p>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the MGR Capital Assistance platform ("Service"), you agree to
              be bound by these Terms of Service. If you do not agree to these terms, do not use
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Description of Service</h2>
            <p>
              MGR Capital Assistance provides surplus funds recovery services, including property
              research, document preparation, filing assistance, and client communication tools.
              The platform supports case management, employee training, and automated outreach
              capabilities.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activities that occur under your account. You must notify us immediately
              of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Share account credentials with unauthorized third parties</li>
              <li>Upload malicious content or files</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Fees and Compensation</h2>
            <p>
              Service fees, commission rates, and subscription costs are outlined in your
              individual service agreement or employment contract. All fees are subject to
              applicable state fee cap regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Confidentiality</h2>
            <p>
              All case data, client information, and proprietary business processes accessed
              through the Service are confidential. Users must not disclose confidential
              information to unauthorized parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. No Guarantee of Recovery</h2>
            <p>
              MGR Capital Assistance does not guarantee the recovery of surplus funds. Results
              depend on court processes, eligibility criteria, and available surplus amounts.
              No fees are charged if no funds are recovered.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, MGR Capital Assistance shall not be liable
              for any indirect, incidental, special, or consequential damages arising from the
              use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">9. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to the Service at any
              time for violation of these terms. You may terminate your account by contacting
              support.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">10. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the Service after
              changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">11. Contact</h2>
            <p>
              For questions about these Terms of Service, contact us at{" "}
              <a href="mailto:legal@mgrcapital.com" className="text-blue-600 hover:underline">
                legal@mgrcapital.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
