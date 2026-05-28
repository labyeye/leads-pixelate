import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, Zap, Eye, EyeOff, Check } from "lucide-react";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    companyName: "",
    name: "",
    email: "",
    password: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((p) => ({ ...p, [key]: e.target.value }));
      setError("");
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.name || !form.email || !form.password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    const result = await register(form);
    setLoading(false);
    if (result.success) {
      navigate("/onboarding");
    } else {
      setError(result.error || "Registration failed.");
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF5] flex">
      <div className="hidden lg:flex w-1/2 bg-[#024BAB] border-r-2 border-black flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black border-2 border-black flex items-center justify-center nb-shadow-sm">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <span className="font-display font-bold text-white text-2xl">
            LeadFlow
          </span>
        </div>

        <div>
          <h1 className="font-display font-bold text-5xl text-white leading-tight mb-6">
            Start capturing
            <br />
            leads in minutes.
          </h1>
          <div className="space-y-3">
            {[
              "Connect IndiaMART & Facebook Ads",
              "Auto-assign leads to your team",
              "Track every follow-up & visit",
              "Know exactly what to do next",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 bg-white border-2 border-white flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-[#024BAB]" />
                </div>
                <span className="text-white font-medium text-base">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          {["Starter ₹999/mo", "Growth ₹2,499/mo", "Enterprise"].map((s) => (
            <div
              key={s}
              className="border-2 border-black bg-black text-white px-3 py-1.5 text-xs font-bold nb-shadow-sm"
            >
              {s}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center">
              <Zap className="w-4 h-4 text-black fill-black" />
            </div>
            <span className="font-display font-bold text-xl text-black">
              LeadFlow
            </span>
          </div>

          <h2 className="font-display font-bold text-3xl text-black mb-1">
            Create your account
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-bold text-black underline hover:text-[#FF3366] transition-colors"
            >
              Sign in
            </Link>
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
                Company / Business Name
              </label>
              <input
                type="text"
                value={form.companyName}
                onChange={set("companyName")}
                placeholder="Acme Pvt Ltd"
                className="nb-input w-full px-3 py-2.5 text-sm"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder="Rahul Sharma"
                className="nb-input w-full px-3 py-2.5 text-sm"
                required
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-1.5">
                Work Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="rahul@company.com"
                className="nb-input w-full px-3 py-2.5 text-sm"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-1.5">
                Password
              </label>
              <div className="flex items-center border-2 border-black nb-shadow-sm">
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Min. 8 characters"
                  className="flex-1 px-3 py-2.5 bg-white text-sm outline-none font-medium"
                  required
                  autoComplete="new-password"
                  minLength={8}
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
              <p className="text-[11px] text-muted-foreground mt-1">
                Must be at least 8 characters
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="nb-btn w-full bg-[#024BAB] text-white py-3 text-sm font-bold mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                "Create Account & Choose Plan →"
              )}
            </button>
          </form>

          <p className="text-[11px] text-center text-muted-foreground mt-6 leading-relaxed">
            By creating an account you agree to our Terms of Service and Privacy
            Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
