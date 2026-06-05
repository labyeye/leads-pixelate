import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { AlertCircle, Zap, Eye, EyeOff } from "lucide-react";
import logoimg from "@/assets/images/Logo.png";
import indiamartLogo from "@/assets/images/logos/indiamart.png";
import facebookLogo from "@/assets/images/logos/facebook.png";
import tradeindiLogo from "@/assets/images/logos/tradeindia.webp";

const PLATFORMS = [
  { label: "IndiaMART", logo: indiamartLogo },
  { label: "Facebook Ads", logo: facebookLogo },
  { label: "TradeIndia", logo: tradeindiLogo },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate("/");
    } else {
      setError(result.error || "Login failed. Please check your credentials.");
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex w-1/2 bg-[#024BAB] border-r-2 border-black flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <img src={logoimg} alt="NestLeads" className="w-14 h-14" />
          <span className="font-display font-bold text-white text-2xl">
            NestLeads
          </span>
        </div>

        <div>
          <h1 className="font-display font-bold text-5xl text-white leading-tight mb-4">
            Every lead.
            <br />
            Every follow-up.
            <br />
            One place.
          </h1>
          <p className="text-white/70 text-lg font-medium max-w-sm">
            Centralize all your leads from various platforms and never miss a
            follow-up again.
          </p>
        </div>

        <div className="flex gap-4">
          {PLATFORMS.map(({ label, logo }) => (
            <div
              key={label}
              className="border-2 border-black bg-white text-black px-3 py-1.5 text-xs font-bold flex items-center gap-2"
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

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <img src="/logo.png" alt="NestLeads" className="w-8 h-8" />
            <span className="font-display font-bold text-xl text-black">
              NestLeads
            </span>
          </div>

          <h2 className="font-display font-bold text-3xl text-black mb-1">
            Welcome back
          </h2>
          <p className="text-muted-foreground text-sm mb-8">
            Sign in to your workspace ·{" "}
          </p>

          {error && (
            <div className="flex items-center gap-2 bg-[#EF4444]/10 border-2 border-[#EF4444] text-[#EF4444] text-sm px-3 py-2.5 mb-5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-black mb-1.5">
                Email
              </label>
              <div className="flex items-center border-2 border-black">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="you@company.com"
                  className="w-full px-3 py-2.5 text-sm"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-1.5">
                Password
              </label>
              <div className="flex items-center border-2 border-black">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Your password"
                  className="flex-1 px-3 py-2.5 bg-white text-sm outline-none font-medium"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="px-3 py-2.5 border-l-2 border-black hover:bg-[#024BAB]/20 transition-colors"
                >
                  {showPw ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className=" w-full hover:bg-[#024BAB] hover:text-white border-2 bg-[#FF751F] text-white py-3 text-sm font-bold mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In →"
              )}
            </button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-6">
            New to NestLeads?{" "}
            <Link
              to="/register"
              className="font-bold text-black underline hover:text-[#FF3366] transition-colors"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
