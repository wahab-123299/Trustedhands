import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <section className="bg-gradient-to-br from-emerald-900/30 to-gray-900 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Privacy Policy</h1>
          <p className="text-gray-400">Last updated: June 15, 2026</p>
        </div>
      </section>

      <section className="py-16 px-6 max-w-4xl mx-auto">
        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-400">
              <li>Name, email, phone, address</li>
              <li>Government ID (for artisans)</li>
              <li>Payment information</li>
            </ul>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. How We Use It</h2>
            <p>To provide, maintain, and improve the Platform.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Contact</h2>
            <p>Email: <span className="text-emerald-400">Trustedhand100@gmail.com</span> | Phone: <span className="text-emerald-400">+234 8089659183</span></p>
          </section>
        </div>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
