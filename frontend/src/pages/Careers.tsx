import React from 'react';
import { MapPin, Briefcase, Clock, ArrowRight } from 'lucide-react';

const Careers: React.FC = () => {
  const openings = [
    { title: "Senior Full-Stack Engineer", dept: "Engineering", location: "Lagos (Hybrid)", type: "Full-time" },
    { title: "Product Designer", dept: "Design", location: "Remote", type: "Full-time" },
    { title: "Customer Success Manager", dept: "Operations", location: "Lagos", type: "Full-time" },
    { title: "Artisan Onboarding Specialist", dept: "Operations", location: "Abuja", type: "Full-time" },
    { title: "Digital Marketing Lead", dept: "Growth", location: "Remote", type: "Full-time" }
  ];

  const benefits = ["Competitive salary & equity", "Health insurance", "Flexible remote work", "Professional development budget", "Paid annual leave", "Team retreats"];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <section className="bg-gradient-to-br from-emerald-900/30 to-gray-900 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Join Our Team</h1>
          <p className="text-xl text-gray-400">Help us build the future of skilled work in Nigeria.</p>
        </div>
      </section>

      <section className="py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center">Why TrustedHand?</h2>
        <div className="grid md:grid-cols-3 gap-6 text-center">
          {["Mission-Driven", "Fast-Growing", "Great Culture"].map((t, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-6">
              <div className="text-3xl font-bold text-emerald-400 mb-2">{t}</div>
              <p className="text-gray-400 text-sm">Building Nigeria's largest artisan marketplace.</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-6 bg-gray-900/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Perks & Benefits</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-sm">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-8">Open Positions</h2>
        <div className="space-y-4">
          {openings.map((job, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-750 transition-colors cursor-pointer group">
              <div>
                <h3 className="text-lg font-semibold group-hover:text-emerald-400 transition-colors">{job.title}</h3>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
                  <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {job.dept}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.location}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {job.type}</span>
                </div>
              </div>
              <button className="flex items-center gap-2 text-emerald-400 font-medium text-sm group-hover:gap-3 transition-all">
                Apply Now <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-center text-gray-500 mt-8 text-sm">
          Don't see your role? Send CV to <span className="text-emerald-400">Trustedhand100@gmail.com</span>
        </p>
      </section>
    </div>
  );
};

export default Careers;
