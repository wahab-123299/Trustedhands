import React, { useState } from 'react';
import { Search, ChevronDown, MessageCircle, Book, Shield, CreditCard, User } from 'lucide-react';

const HelpCenter = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { icon: <User className="w-5 h-5" />, name: "Account & Profile", count: 12 },
    { icon: <Book className="w-5 h-5" />, name: "Getting Started", count: 8 },
    { icon: <CreditCard className="w-5 h-5" />, name: "Payments & Billing", count: 15 },
    { icon: <Shield className="w-5 h-5" />, name: "Trust & Safety", count: 10 },
    { icon: <MessageCircle className="w-5 h-5" />, name: "Messaging & Jobs", count: 14 }
  ];

  const faqs = [
    { q: "How do I hire an artisan on TrustedHand?", a: "Simply browse our verified artisans by category or location, view their profiles and reviews, then click 'Hire' or 'Request Quote'. You can also post a job and let artisans come to you with quotes." },
    { q: "Is payment secure on TrustedHand?", a: "Yes! We use an escrow payment system. Your payment is held securely until you confirm the job is completed to your satisfaction. Only then is the funds released to the artisan." },
    { q: "How are artisans verified?", a: "Every artisan undergoes identity verification, skill assessment, and background checks. We verify government-issued ID, check references, and in some cases conduct in-person skill tests." },
    { q: "What if I'm not satisfied with the work?", a: "Contact the artisan first to resolve the issue. If that doesn't work, open a dispute through your job dashboard. Our support team will mediate and help reach a fair resolution." },
    { q: "How do I become a verified artisan?", a: "Sign up as an artisan, complete your profile with skills and portfolio, then submit for verification. You'll need to upload a valid ID and may need to complete a skill assessment." },
    { q: "What fees does TrustedHand charge?", a: "Clients pay a small service fee (5%) on top of the artisan's quote. Artisans pay a 10% commission on completed jobs. There are no hidden fees or subscription costs." },
    { q: "Can I cancel a job after hiring?", a: "Yes, you can cancel before work begins with no penalty. If work has started, cancellation terms depend on the agreement with the artisan and our cancellation policy." },
    { q: "How do I contact support?", a: "You can reach us via live chat in the app, email at Trustedhand100@gmail.com, or call +234 8089659183 during business hours (Mon-Fri, 9am-6pm WAT)." }
  ];

  const filteredFaqs = faqs.filter(f => 
    f.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <section className="bg-gradient-to-br from-emerald-900/30 to-gray-900 py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Help Center</h1>
          <p className="text-xl text-gray-400 mb-8">How can we help you today?</p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search for answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-12 pr-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </section>

      {!searchQuery && (
        <section className="py-12 px-6 max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {categories.map((cat, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-4 text-center hover:bg-gray-750 transition-colors cursor-pointer">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 mx-auto mb-3">
                  {cat.icon}
                </div>
                <div className="font-medium text-sm">{cat.name}</div>
                <div className="text-xs text-gray-500 mt-1">{cat.count} articles</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="py-12 px-6 max-w-3xl mx-auto pb-20">
        <h2 className="text-2xl font-bold mb-6">{searchQuery ? 'Search Results' : 'Frequently Asked Questions'}</h2>
        <div className="space-y-3">
          {filteredFaqs.map((faq, i) => (
            <div key={i} className="bg-gray-800 rounded-xl overflow-hidden">
              <button 
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-750 transition-colors"
              >
                <span className="font-medium pr-4">{faq.q}</span>
                <ChevronDown className={`w-5 h-5 shrink-0 text-gray-500 transition-transform ${openIndex === i ? 'rotate-180' : ''}`} />
              </button>
              {openIndex === i && (
                <div className="px-5 pb-5 text-gray-400 leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
          {filteredFaqs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No results found for "{searchQuery}". Try a different search term or contact support.
            </div>
          )}
        </div>

        <div className="mt-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">Still need help?</h3>
          <p className="text-gray-400 mb-4">Our support team is available Monday to Friday, 9am - 6pm WAT</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="mailto:Trustedhand100@gmail.com" className="bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-600 transition-colors">
              Email Support
            </a>
            <a href="https://wa.me/2348089659183" className="bg-gray-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors">
              WhatsApp Chat
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HelpCenter;