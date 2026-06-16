import React from 'react';
import { Newspaper, Download, ExternalLink } from 'lucide-react';

const Press: React.FC = () => {
  const articles = [
    { source: "TechCabal", title: "TrustedHand Raises $2M to Expand Across Nigeria", date: "March 15, 2026", excerpt: "Building the largest verified artisan network in West Africa...", link: "#" },
    { source: "Techpoint Africa", title: "Solving Nigeria's Skilled Labor Crisis", date: "January 22, 2026", excerpt: "5,000+ verified artisans changing how Nigerians hire...", link: "#" },
    { source: "BusinessDay", title: "Lagos State Partnership for Verification", date: "November 8, 2025", excerpt: "Aim to verify 10,000 artisans across Lagos by 2027...", link: "#" }
  ];

  const assets = [
    { name: "Logo Pack (PNG, SVG)", size: "2.4 MB" },
    { name: "Brand Guidelines PDF", size: "1.8 MB" },
    { name: "Founder Headshots", size: "5.1 MB" },
    { name: "Product Screenshots", size: "3.2 MB" }
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <section className="bg-gradient-to-br from-emerald-900/30 to-gray-900 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Press & Media</h1>
          <p className="text-xl text-gray-400">Latest news and resources about TrustedHand.</p>
        </div>
      </section>

      <section className="py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
          <Newspaper className="w-8 h-8 text-emerald-400" /> In the News
        </h2>
        <div className="space-y-6">
          {articles.map((a, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-emerald-400 font-semibold text-sm">{a.source}</span>
                <span className="text-gray-500 text-sm">&bull; {a.date}</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">{a.title}</h3>
              <p className="text-gray-400 mb-4">{a.excerpt}</p>
              <a href={a.link} className="inline-flex items-center gap-2 text-emerald-400 text-sm hover:underline">
                Read Article <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-6 bg-gray-900/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8">Press Kit</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {assets.map((a, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between hover:bg-gray-750 cursor-pointer">
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="font-medium text-sm">{a.name}</div>
                    <div className="text-xs text-gray-500">{a.size}</div>
                  </div>
                </div>
                <button className="text-emerald-400 text-sm font-medium">Download</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 max-w-4xl mx-auto text-center">
        <h2 className="text-2xl font-bold mb-4">Media Inquiries</h2>
        <a href="mailto:Trustedhand100@gmail.com" className="inline-flex items-center gap-2 bg-emerald-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-600 transition-colors">
          Contact Press Team
        </a>
      </section>
    </div>
  );
};

export default Press;
