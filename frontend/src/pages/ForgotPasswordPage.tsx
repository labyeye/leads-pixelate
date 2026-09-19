import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Mail, KeyRound } from "lucide-react";
import logoimg from "@/assets/images/Logo.png";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { authAPI } from "@/services/api";

type Step = "email" | "choose" | "email_sent" | "otp" | "totp" | "done";

const METHOD_INFO: Record<
  string,
  { label: string; desc: string; icon: React.ReactNode }
> = {
  email: {
    label: "Email link",
    desc: "Get a password reset link in your inbox",
    icon: <Mail className="w-5 h-5" />,
  },
  whatsapp: {
    label: "WhatsApp code",
    desc: "Get a 6-digit code on your verified WhatsApp number",
    icon: <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />,
  },
  totp: {
    label: "Authenticator app",
    desc: "Enter the code from your authenticator app",
    icon: <KeyRound className="w-5 h-5" />,
  },
};

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [methods, setMethods] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [activeMethod, setActiveMethod] = useState<"whatsapp" | "totp" | null>(
    null,
  );

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authAPI.forgotPasswordMethods(email);
      setMethods(res.data.methods);
      setStep(res.data.methods.length > 1 ? "choose" : "email_sent");
      if (res.data.methods.length <= 1) {
        await authAPI.forgotPassword(email);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const chooseMethod = async (method: string) => {
    setError("");
    setLoading(true);
    try {
      if (method === "email") {
        await authAPI.forgotPassword(email);
        setStep("email_sent");
      } else if (method === "whatsapp") {
        await authAPI.forgotPasswordWhatsapp(email);
        setActiveMethod("whatsapp");
        setStep("otp");
      } else if (method === "totp") {
        setActiveMethod("totp");
        setStep("totp");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      if (activeMethod === "whatsapp") {
        await authAPI.resetPasswordWithOtp(email, code, password);
      } else {
        await authAPI.resetPasswordWithTotp(email, code, password);
      }
      setStep("done");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fffafa] flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <img src={logoimg} alt="NestLeads" className="w-10 h-10" />
          <span className="font-display font-bold text-xl text-black">
            NestLeads
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-[#EF4444]/10 border-2 border-[#EF4444] text-[#EF4444] text-sm px-3 py-2.5 mb-5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {step === "email" && (
          <>
            <h2 className="font-display font-bold text-3xl text-black mb-1">
              Forgot password?
            </h2>
            <p className="text-muted-foreground text-sm mb-8">
              Enter your email to see how you can reset your password.
            </p>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
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
                    Checking...
                  </span>
                ) : (
                  "Continue →"
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

        {step === "choose" && (
          <>
            <h2 className="font-display font-bold text-2xl text-black mb-1">
              How do you want to reset it?
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              Choose one of the methods set up on your account.
            </p>
            <div className="space-y-3">
              {methods.map((m) => (
                <button
                  key={m}
                  onClick={() => chooseMethod(m)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 border-2 border-black p-3.5 text-left hover:bg-[#024BAB]/5 transition-colors disabled:opacity-50"
                >
                  <div className="w-9 h-9 border-2 border-black bg-white flex items-center justify-center shrink-0">
                    {METHOD_INFO[m]?.icon ?? <Mail className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-black">
                      {METHOD_INFO[m]?.label ?? m}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {METHOD_INFO[m]?.desc ?? ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep("email")}
              className="text-xs font-bold text-muted-foreground hover:text-black mt-6"
            >
              ← Back
            </button>
          </>
        )}

        {step === "email_sent" && (
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
        )}

        {(step === "otp" || step === "totp") && (
          <>
            <h2 className="font-display font-bold text-2xl text-black mb-1">
              {step === "otp" ? "Enter WhatsApp code" : "Enter authenticator code"}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              {step === "otp"
                ? "We sent a 6-digit code to your verified WhatsApp number."
                : "Open your authenticator app and enter the current 6-digit code."}
            </p>

            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-black mb-1.5">
                  {step === "otp" ? "WhatsApp code" : "Authenticator code"}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="123456"
                  className="w-full px-3 py-2.5 text-sm border-2 border-black tracking-widest text-center font-bold"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-black mb-1.5">
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full px-3 py-2.5 text-sm border-2 border-black"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-black mb-1.5">
                  Confirm new password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border-2 border-black"
                  required
                  autoComplete="new-password"
                />
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
                  "Reset Password"
                )}
              </button>
            </form>

            <button
              onClick={() => setStep("choose")}
              className="text-xs font-bold text-muted-foreground hover:text-black mt-6"
            >
              ← Choose a different method
            </button>
          </>
        )}

        {step === "done" && (
          <div className="text-center">
            <div className="w-14 h-14 border-2 border-black bg-[#00C48C]/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-[#00C48C]" />
            </div>
            <h2 className="font-display font-bold text-2xl text-black mb-2">
              Password reset!
            </h2>
            <p className="text-muted-foreground text-sm mb-8">
              Your password has been changed. You can now sign in.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="inline-block w-full border-2 border-black bg-[#024BAB] text-white py-3 text-sm font-bold hover:bg-black transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
