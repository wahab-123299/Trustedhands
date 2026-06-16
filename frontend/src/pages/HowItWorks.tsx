import React from 'react';
import { Search, FileText, MessageCircle, ShieldCheck, Star } from 'lucide-react';

const HowItWorks: React.FC = () => {
  const clientSteps = [
    { icon: <Search className="w-10 h-10 text-emerald-400" />, title: "1. Search & Discover", desc: "Browse verified artisans by category, location, or skill. View portfolios, ratings, and reviews." },
    { icon: <FileText className="w-10 h-10 text-emerald-400" />, title: "2. Post or Request", desc: "Post a job with budget and timeline, or request a quote from matching artisans." },
    { icon: <MessageCircle className="w-10 h-10 text-emerald-400" />, title: "3. Connect & Agree", desc: "Chat directly with artisans and agree on terms. All communication stays on-platform." },
    { icon: <ShieldCheck className="w-10 h-10 text-emerald-400" />, title: "4. Secure Payment", desc: "Pay through our escrow system. Funds held safely until job completion." },
    { icon: <Star className="w-10 h-10 text-emerald-400" />, title: "5. Review & Repeat", desc: "Rate your experience and build relationships with trusted artisans." }
  ];

  const artisanSteps = [
    { icon: <FileText className="w-10 h-10 text-blue-400" />, title: "1. Create Profile", desc: "Sign up, verify identity, and showcase your skills and portfolio." },
    { icon: <Search className="w-10 h-10 text-blue-400" />, title: "2. Find Jobs", desc: "Browse job postings or get matched with clients needing your skills." },
    { icon: <MessageCircle className="w-10 h-10 text-blue-400" />, title: "3. Quote & Win", desc: "Submit competitive quotes and win jobs based on your reputation." },
    { icon: <ShieldCheck className="w-10 h-10 text-blue-400" />, title: "4. Get Paid", desc: "Complete jobs, get paid securely, and build your reputation." }
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <section className="bg-gradient-to-br from-emerald-900/30 to-gray-900 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">How TrustedHand Works</h1>
          <p className="text-xl text-gray-400">Simple, secure, and straightforward.</p>
        </div>
      </section>

      <section className="py-16 px-6 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-emerald-400 mb-8 text-center">For Clients</h2>
        <div className="space-y-6">
          {clientSteps.map((s, i) => (
            <div key={i} className="flex gap-6 bg-gray-800/50 rounded-xl p-6 items-start">
              <div className="shrink-0">{s.icon}</div>
              <div>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-gray-400">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-6 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-blue-400 mb-8 text-center">For Artisans</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {artisanSteps.map((s, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-6">
                <div className="mb-4">{s.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;
