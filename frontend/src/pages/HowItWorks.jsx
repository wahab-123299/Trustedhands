import React from 'react';
import { Search, FileText, MessageCircle, ShieldCheck, Star } from 'lucide-react';

const HowItWorks = () => {
  const steps = [
    {
      icon: <Search className="w-10 h-10 text-emerald-400" />,
      title: "1. Search & Discover",
      desc: "Browse through verified artisans by category, location, or skill. View portfolios, ratings, and reviews to find the perfect match for your job."
    },
    {
      icon: <FileText className="w-10 h-10 text-emerald-400" />,
      title: "2. Post or Request",
      desc: "Post a detailed job description with your budget and timeline, or directly request a quote from artisans whose profiles match your needs."
    },
    {
      icon: <MessageCircle className="w-10 h-10 text-emerald-400" />,
      title: "3. Connect & Agree",
      desc: "Chat directly with artisans, discuss details, and agree on terms. All communication stays on-platform for your protection."
    },
    {
      icon: <ShieldCheck className="w-10 h-10 text-emerald-400" />,
      title: "4. Secure Payment",
      desc: "Pay securely through our escrow system. Funds are held safely until the job is completed to your satisfaction."
    },
    {
      icon: <Star className="w-10 h-10 text-emerald-400" />,
      title: "5. Review & Repeat",
      desc: "Rate your experience and leave a review. Build relationships with artisans you trust for future projects."
    }
  ];

  const artisanSteps = [
    {
      icon: <FileText className="w-10 h-10 text-blue-400" />,
      title: "1. Create Your Profile",
      desc: "Sign up, verify your identity, and build a compelling profile showcasing your skills, portfolio, and experience."
    },
    {
      icon: <Search className="w-10 h-10 text-blue-400" />,
      title: "2. Find Jobs",
      desc: "Browse job postings in your area and category, or get matched with clients looking for your specific skills."
    },
    {
      icon: <MessageCircle className="w-10 h-10 text-blue-400" />,
      title: "3. Quote & Win",
      desc: "Submit competitive quotes, communicate with clients, and win jobs based on your skills and reputation."
    },
    {
      icon: <ShieldCheck className="w-10 h-10 text-blue-400" />,
      title: "4. Get Paid Securely",
      desc: "Complete the job, get paid through our secure system, and build your reputation with every successful project."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <section className="bg-gradient-to-br from-emerald-900/30 to-gray-900 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">How TrustedHand Works</h1>
          <p className="text-xl text-gray-400">Simple, secure, and straightforward — for both clients and artisans.</p>
        </div>
      </section>

      <section className="py-16 px-6 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-emerald-400 mb-8 text-center">For Clients</h2>
        <div className="space-y-6">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-6 bg-gray-800/50 rounded-xl p-6 items-start">
              <div className="shrink-0">{step.icon}</div>
              <div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-400">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-6 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-blue-400 mb-8 text-center">For Artisans</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {artisanSteps.map((step, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-6">
                <div className="mb-4">{step.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;