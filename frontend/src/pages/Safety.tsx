// src/pages/Safety.jsx
import { Shield, Eye, Lock, MessageSquare, Phone, AlertTriangle, CheckCircle } from 'lucide-react';

const Safety = () => {
  const measures = [
    {
      icon: <Shield className="w-8 h-8 text-emerald-400" />,
      title: "Verified Identities",
      desc: "Every artisan undergoes government ID verification and background checks before joining the platform."
    },
    {
      icon: <Lock className="w-8 h-8 text-emerald-400" />,
      title: "Secure Payments",
      desc: "Our escrow system holds your payment until the job is completed to your satisfaction. Never pay upfront to an artisan directly."
    },
    {
      icon: <Eye className="w-8 h-8 text-emerald-400" />,
      title: "Transparent Reviews",
      desc: "All reviews are from verified clients who have actually hired the artisan. We do not allow fake or incentivized reviews."
    },
    {
      icon: <MessageSquare className="w-8 h-8 text-emerald-400" />,
      title: "On-Platform Messaging",
      desc: "Keep all communication on TrustedHand. This creates a record for dispute resolution and protects both parties."
    }
  ];

  const tips = [
    "Always communicate through TrustedHand's messaging system",
    "Never share personal banking details or passwords",
    "Verify the artisan's identity badge before allowing them into your home",
    "For large jobs, consider meeting in a public place first",
    "Report suspicious behavior immediately to our Trust & Safety team",
    "Read previous reviews and check completion rates before hiring"
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <section className="bg-gradient-to-br from-emerald-900/30 to-slate-900 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Shield className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Your Safety is Our Priority</h1>
          <p className="text-xl text-slate-400">
            TrustedHand is built on trust. Here's how we keep you safe.
          </p>
        </div>
      </section>

      {/* Safety Measures */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6">
          {measures.map((m, i) => (
            <div key={i} className="bg-slate-800 rounded-xl p-6 flex gap-4">
              <div className="shrink-0">{m.icon}</div>
              <div>
                <h3 className="text-lg font-semibold mb-2">{m.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Safety Tips */}
      <section className="py-16 px-6 bg-slate-900/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Safety Tips for Clients</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-3 bg-slate-800 rounded-lg p-4">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-300">{tip}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Report Section */}
      <section className="py-16 px-6 max-w-4xl mx-auto text-center">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">Report a Safety Concern</h2>
        <p className="text-slate-400 mb-6 max-w-2xl mx-auto">
          If you experience or witness any suspicious activity, inappropriate behavior, or feel unsafe at any point, please report it immediately.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="mailto:safety@trustedhand.ng" className="bg-red-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Report an Issue
          </a>
          <a href="tel:+2349034567890" className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
            <Phone className="w-4 h-4" /> Emergency Line
          </a>
        </div>
      </section>
    </div>
  );
};

export default Safety;