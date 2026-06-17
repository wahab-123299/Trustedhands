
import { Shield, Users, Target, Heart } from 'lucide-react';

const AboutUs = () => {
  const values = [
    {
      icon: <Shield className="w-8 h-8 text-emerald-500" />,
      title: "Trust & Verification",
      desc: "Every artisan on our platform undergoes rigorous identity verification, skill assessment, and background checks before they can offer services."
    },
    {
      icon: <Users className="w-8 h-8 text-emerald-500" />,
      title: "Community First",
      desc: "We believe in building a community where artisans and clients connect with mutual respect, transparency, and fair pricing."
    },
    {
      icon: <Target className="w-8 h-8 text-emerald-500" />,
      title: "Quality Guaranteed",
      desc: "Our escrow payment system and satisfaction guarantee ensure you only pay for work that meets your expectations."
    },
    {
      icon: <Heart className="w-8 h-8 text-emerald-500" />,
      title: "Empowering Artisans",
      desc: "We provide artisans with tools, visibility, and opportunities to grow their businesses and reach more clients across Nigeria."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-900/30 to-slate-900 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">About TrustedHand</h1>
          <p className="text-xl text-slate-400 leading-relaxed">
            We're on a mission to transform how Nigerians find and hire skilled artisans — making it safer, faster, and more reliable than ever before.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 px-6 max-w-4xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-6">Our Story</h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              TrustedHand was born from a simple frustration: finding reliable artisans in Nigeria was a gamble. From electricians who never showed up to plumbers who overcharged, the experience was broken.
            </p>
            <p className="text-slate-400 leading-relaxed mb-4">
              Founded in 2024, we set out to build a platform that connects verified, skilled artisans with homeowners and businesses who need quality work done right the first time.
            </p>
            <p className="text-slate-400 leading-relaxed">
              Today, TrustedHand is home to thousands of verified artisans across Lagos, Abuja, Port Harcourt, and beyond — and we're just getting started.
            </p>
          </div>
          <div className="bg-slate-800 rounded-2xl p-8 text-center">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-3xl font-bold text-emerald-400">5,000+</div>
                <div className="text-sm text-slate-400 mt-1">Verified Artisans</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-emerald-400">12,000+</div>
                <div className="text-sm text-slate-400 mt-1">Jobs Completed</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-emerald-400">15+</div>
                <div className="text-sm text-slate-400 mt-1">Service Categories</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-emerald-400">4.8/5</div>
                <div className="text-sm text-slate-400 mt-1">Average Rating</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 px-6 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Our Core Values</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-6 hover:bg-slate-750 transition-colors">
                <div className="mb-4">{v.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{v.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutUs;