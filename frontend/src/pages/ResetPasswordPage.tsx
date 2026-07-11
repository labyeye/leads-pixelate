import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import logoimg from "@/assets/images/Logo.png";
import { authAPI } from "@/services/api";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!token) {
      setError("This reset link is invalid.");
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err: any) {
      setError(
        err.message || "This reset link is invalid or has expired.",
      );
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

        {done ? (
          <div className="text-center">
            <div className="w-14 h-14 border-2 border-black bg-[#024BAB]/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-[#024BAB]" />
            </div>
            <h2 className="font-display font-bold text-2xl text-black mb-2">
              Password reset
            </h2>
            <p className="text-muted-foreground text-sm">
              Redirecting you to sign in...
            </p>
          </div>
        ) : (
          <>
            <h2 className="font-display font-bold text-3xl text-black mb-1">
              Set a new password
            </h2>
            <p className="text-muted-foreground text-sm mb-8">
              Choose a strong password for your account.
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
                  New password
                </label>
                <div className="flex items-center border-2 border-black">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="At least 8 characters"
                    className="flex-1 px-3 py-2.5 bg-white text-sm outline-none font-medium"
                    required
                    autoComplete="new-password"
                    autoFocus
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

              <div>
                <label className="block text-sm font-bold text-black mb-1.5">
                  Confirm password
                </label>
                <div className="flex items-center border-2 border-black">
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="Re-enter your password"
                    className="w-full px-3 py-2.5 text-sm outline-none font-medium"
                    required
                    autoComplete="new-password"
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
                    Resetting...
                  </span>
                ) : (
                  "Reset Password →"
                )}
              </button>
            </form>

            <p className="text-xs text-center text-muted-foreground mt-6">
              <Link
                to="/login"
                className="font-bold text-black underline hover:text-[#FF3366] transition-colors"
              >
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
