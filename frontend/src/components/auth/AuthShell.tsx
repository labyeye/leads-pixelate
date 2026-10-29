import {
  Target,
  RefreshCw,
  BarChart2,
  Layers,
} from "lucide-react";
import logoimg from "@/assets/images/Logo.png";
import indiamartLogo from "@/assets/images/logos/indiamart.png";
import facebookLogo from "@/assets/images/logos/meta.png";
import tradeindiLogo from "@/assets/images/logos/tradeindia.webp";
import justdialLogo from "@/assets/images/logos/justdial.webp";
import googleAdsLogo from "@/assets/images/logos/google.webp";

const PLATFORMS = [
  { label: "IndiaMART", logo: indiamartLogo },
  { label: "Meta Ads", logo: facebookLogo },
  { label: "TradeIndia", logo: tradeindiLogo },
  { label: "JustDial", logo: justdialLogo },
  { label: "Google Ads", logo: googleAdsLogo },
];

const features = [
  { icon: Target, label: "Lead Capture" },
  { icon: RefreshCw, label: "Follow-ups" },
  { icon: BarChart2, label: "Reports & Analytics" },
  { icon: Layers, label: "Multi-Platform" },
];

// Same split layout as LoginPage: blue pitch panel stays, only the right-hand form changes.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-[#024BAB] flex-col justify-between p-10 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img
            src={logoimg}
            alt="NestLeads"
            className="w-14 h-14 object-contain"
          />
          <span className="font-display font-medium text-white text-2xl">
            NestLeads
          </span>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <h1 className="text-3xl xl:text-4xl font-display font-medium text-white leading-tight mb-5">
            Every lead.
            
            Every follow-up.
            
            One place.
          </h1>
          <p className="text-white/70 text-base font-medium max-w-sm">
            Centralize all your leads from various platforms and never miss a
            follow-up again.
          </p>
        </div>

        {/* Feature pills */}
        <div className="relative z-10 flex flex-wrap gap-2">
          {features.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2 text-white text-sm font-medium"
            >
              <Icon className="w-4 h-4 text-white/70" />
              {label}
            </div>
          ))}
        </div>

        {/* Platform logos row */}
        <div className="relative z-10 flex flex-wrap gap-2">
          {PLATFORMS.map(({ label, logo }) => (
            <div
              key={label}
              className="border-2 border-black bg-white text-black px-3 py-1.5 text-xs font-medium flex items-center gap-2"
            >
              <img
                src={logo}
                alt={label}
                className="w-4 h-4 object-contain rounded-sm"
              />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-white flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img
              src={logoimg}
              alt="NestLeads"
              className="w-10 h-10 object-contain"
            />
            <span className="font-display font-medium text-xl text-black">
              NestLeads
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
