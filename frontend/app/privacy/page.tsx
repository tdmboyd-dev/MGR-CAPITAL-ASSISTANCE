"use client";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: February 2, 2026</p>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>
                <strong>Account Information:</strong> Name, email address, phone number, and
                role-specific details when you create an account.
              </li>
              <li>
                <strong>Case Data:</strong> Property addresses, court case numbers, surplus fund
                amounts, and related legal documents for cases you are involved with.
              </li>
              <li>
                <strong>Communication Records:</strong> Messages, emails, SMS, and call logs
                processed through the platform.
              </li>
              <li>
                <strong>Usage Data:</strong> Login activity, feature usage, and platform
                interaction metrics.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Provide and maintain surplus funds recovery services</li>
              <li>Process claims, generate documents, and file with courts</li>
              <li>Communicate with clients regarding case status and updates</li>
              <li>Train and evaluate employee performance</li>
              <li>Improve platform functionality and user experience</li>
              <li>Comply with legal obligations and court requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Data Sharing</h2>
            <p>We may share your information with:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Courts and government agencies as required for claim processing</li>
              <li>Service providers who assist with platform operations (email, SMS, payments)</li>
              <li>Legal counsel when necessary for compliance or dispute resolution</li>
            </ul>
            <p className="mt-2">
              We do not sell personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Data Security</h2>
            <p>
              We implement industry-standard security measures including encrypted database
              backups, JWT-based authentication with token rotation, role-based access control,
              and audit logging of all critical actions. Sensitive data is encrypted at rest
              and in transit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Data Retention</h2>
            <p>
              Case data is retained for the duration of active claims and for a period of 7
              years following case closure to comply with legal record-keeping requirements.
              Account data is retained while your account is active and for 30 days following
              account deletion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data (subject to legal retention requirements)</li>
              <li>Object to certain processing of your data</li>
              <li>Receive a copy of your data in a portable format</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. Cookies and Tracking</h2>
            <p>
              We use essential cookies for authentication and session management. We do not
              use third-party advertising trackers. Analytics data is collected in aggregate
              to improve platform performance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. TCPA Compliance</h2>
            <p>
              All automated communications (SMS, phone calls) comply with the Telephone
              Consumer Protection Act. Outreach is limited to business hours (8:00 AM -
              9:00 PM local time) and clients may opt out at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">9. Children&#39;s Privacy</h2>
            <p>
              The Service is not intended for individuals under the age of 18. We do not
              knowingly collect personal information from minors.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify users of
              material changes via email or platform notification.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">11. Contact</h2>
            <p>
              For privacy-related inquiries, contact us at{" "}
              <a href="mailto:privacy@mgrcapital.com" className="text-blue-600 hover:underline">
                privacy@mgrcapital.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
