import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "@/components/auth/AuthShell";
import { AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import PasswordChecklist from "@/components/PasswordChecklist";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    companyName: "",
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((p) => ({ ...p, [key]: e.target.value }));
      setError("");
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.companyName.trim()) {
      setError("Company / Business Name is required.");
      return;
    }
    if (!form.name.trim()) {
      setError("Your name is required.");
      return;
    }
    if (!form.email.trim()) {
      setError("Email address is required.");
      return;
    }
    if (!EMAIL_RE.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!form.password) {
      setError("Password is required.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!form.confirmPassword) {
      setError("Please confirm your password.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { confirmPassword: _, ...payload } = form;
    const result = await register(payload);
    setLoading(false);
    if (result.success) {
      navigate("/onboarding");
    } else {
      setError(result.error || "Registration failed.");
    }
  };

  return (
    <AuthShell>
          <h2 className="font-display font-medium text-3xl text-black mb-1">
            Create your account
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-black underline hover:text-[#FF3366] transition-colors"
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

          <form onSubmit={handleSubmit} className="space-y-5 login-anim">
            <div>
              <label className="block text-xs font-medium text-black uppercase tracking-wider mb-1.5">
                Company / Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.companyName}
                onChange={set("companyName")}
                placeholder="Acme Pvt Ltd"
                className="w-full px-4 py-3 border-2 border-black text-sm font-medium bg-white focus:outline-none transition-colors"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-black uppercase tracking-wider mb-1.5">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder="Rahul Sharma"
                className="w-full px-4 py-3 border-2 border-black text-sm font-medium bg-white focus:outline-none transition-colors"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-black uppercase tracking-wider mb-1.5">
                Work Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="rahul@company.com"
                className="w-full px-4 py-3 border-2 border-black text-sm font-medium bg-white focus:outline-none transition-colors"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-black uppercase tracking-wider mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="flex border-2 border-black">
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Create a strong password"
                  className="flex-1 px-4 py-3 bg-white text-sm font-medium outline-none"
                  autoComplete="new-password"
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
              {form.password && <PasswordChecklist password={form.password} />}
              {form.password && form.password.length < 8 && (
                <p className="text-[11px] text-red-500 mt-1">
                  Must be at least 8 characters
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-black uppercase tracking-wider mb-1.5">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="flex border-2 border-black">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={set("confirmPassword")}
                  placeholder="Re-enter password"
                  className="flex-1 px-4 py-3 bg-white text-sm font-medium outline-none"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="px-3 py-2.5 border-l-2 border-black hover:bg-[#024BAB]/20 transition-colors"
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {form.confirmPassword &&
                form.password !== form.confirmPassword && (
                  <p className="text-[11px] text-red-500 mt-1">
                    Passwords do not match
                  </p>
                )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#024BAB] text-white py-3.5 text-sm font-medium border-2 border-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0a0a0a] transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                <>Create Account & Choose Plan <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-[11px] text-center text-muted-foreground mt-6 leading-relaxed">
            By creating an account you agree to our Terms of Service and Privacy
            Policy.
          </p>
    </AuthShell>
  );
}
