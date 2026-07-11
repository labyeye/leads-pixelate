import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import logoimg from "@/assets/images/Logo.png";
import { authAPI } from "@/services/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      // Always show the success state — the API never reveals whether the
      // email exists, so the UI shouldn't either.
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <img src={logoimg} alt="NestLeads" className="w-10 h-10" />
          <span className="font-display font-bold text-xl text-black">
            NestLeads
          </span>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 border-2 border-black bg-[#024BAB]/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-[#024BAB]" />
            </div>
            <h2 className="font-display font-bold text-2xl text-black mb-2">
              Check your email
            </h2>
            <p className="text-muted-foreground text-sm mb-8">
              If an account exists for <strong>{email}</strong>, we've sent a
              password reset link. It expires in 1 hour.
            </p>
            <Link
              to="/login"
              className="inline-block w-full border-2 border-black bg-[#024BAB] text-white py-3 text-sm font-bold hover:bg-black transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <h2 className="font-display font-bold text-3xl text-black mb-1">
              Forgot password?
            </h2>
            <p className="text-muted-foreground text-sm mb-8">
              Enter your email and we'll send you a reset link.
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

              <button
                type="submit"
                disabled={loading}
                className="w-full hover:bg-[#024BAB] hover:text-white border-2 bg-[#FF751F] text-white py-3 text-sm font-bold mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : (
                  "Send Reset Link →"
                )}
              </button>
            </form>

            <p className="text-xs text-center text-muted-foreground mt-6">
              Remembered your password?{" "}
              <Link
                to="/login"
                className="font-bold text-black underline hover:text-[#FF3366] transition-colors"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
