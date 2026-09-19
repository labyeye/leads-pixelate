import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import {
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Target,
  RefreshCw,
  BarChart2,
  Layers,
  ShieldCheck,
  Smartphone,
  KeyRound,
} from "lucide-react";
import logoimg from "@/assets/images/Logo.png";
import indiamartLogo from "@/assets/images/logos/indiamart.png";
import facebookLogo from "@/assets/images/logos/meta.png";
import tradeindiLogo from "@/assets/images/logos/tradeindia.webp";
import justdialLogo from "@/assets/images/logos/justdial.webp";
import googleAdsLogo from "@/assets/images/logos/google.webp";
import { authAPI } from "@/services/api";

// ── WebAuthn helpers ──────────────────────────────────────────────────────────
function b64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function bufferToB64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ── Static data ───────────────────────────────────────────────────────────────
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

type LoginMode = "email" | "phone" | "passkey";

export default function LoginPage() {
  const { login, completeLogin } = useAuth();
  const navigate = useNavigate();

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<LoginMode>("email");
  const [error, setError] = useState("");

  // ── Email / Password ────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── TOTP 2FA (shown after successful email+password on 2FA-enabled accounts) ─
  const [needs2FA, setNeeds2FA] = useState(false);
  const [pending2FAUserId, setPending2FAUserId] = useState("");
  const [tfaCode, setTfaCode] = useState("");

  // ── Phone OTP (WhatsApp) ────────────────────────────────────────────────────
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  // ── Passkey ─────────────────────────────────────────────────────────────────
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  // Email + password sign-in
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate("/");
    } else if (result.requires2FA) {
      setNeeds2FA(true);
      setPending2FAUserId(result.userId || "");
    } else {
      setError(result.error || "Login failed. Please check your credentials.");
    }
  };

  // TOTP 2FA verification
  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authAPI.verify2FA(pending2FAUserId, tfaCode);
      const { ...userData } = res.data;
      completeLogin(userData, "");
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Invalid code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Send WhatsApp OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOtpLoading(true);
    try {
      await authAPI.loginSendOtp(phone.trim());
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify WhatsApp OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOtpLoading(true);
    try {
      const res = await authAPI.loginVerifyOtp(phone.trim(), otp.trim());
      completeLogin(res.data, "");
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Invalid or expired OTP.");
    } finally {
      setOtpLoading(false);
    }
  };

  // Passkey / WebAuthn login
  const handlePasskeyLogin = async () => {
    if (!window.PublicKeyCredential) {
      setError("Passkeys are not supported by your browser.");
      return;
    }
    setError("");
    setPasskeyLoading(true);
    try {
      // 1. Fetch challenge from server
      const optRes = await authAPI.passkeyLoginOptions();
      const opts = optRes.data;

      // 2. Decode base64url fields
      opts.challenge = b64urlToBuffer(opts.challenge);
      if (opts.allowCredentials) {
        opts.allowCredentials = opts.allowCredentials.map((c: any) => ({
          ...c,
          id: b64urlToBuffer(c.id),
        }));
      }

      // 3. Browser prompts user (Face ID / fingerprint / hardware key / PIN)
      const credential = (await navigator.credentials.get({
        publicKey: opts,
      })) as PublicKeyCredential;

      if (!credential) throw new Error("Passkey prompt was cancelled.");

      const resp = credential.response as AuthenticatorAssertionResponse;

      // 4. Re-encode and send assertion to server
      const assertion = {
        id: credential.id,
        rawId: bufferToB64url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToB64url(resp.clientDataJSON),
          authenticatorData: bufferToB64url(resp.authenticatorData),
          signature: bufferToB64url(resp.signature),
          userHandle: resp.userHandle ? bufferToB64url(resp.userHandle) : null,
        },
      };

      const loginRes = await authAPI.passkeyLogin(assertion);
      completeLogin(loginRes.data, "");
      navigate("/");
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Passkey authentication was cancelled.");
      } else {
        setError(err.message || "Passkey login failed. Try another method.");
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  // ── Shared error banner ───────────────────────────────────────────────────
  const ErrorBanner = () =>
    error ? (
      <div className="flex items-center gap-2 bg-red-50 border-2 border-red-400 text-red-600 text-sm px-3 py-2.5 mb-5">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span className="font-medium">{error}</span>
      </div>
    ) : null;

  // ── Primary button ─────────────────────────────────────────────────────────
  const PrimaryBtn = ({
    disabled,
    isLoading,
    children,
  }: {
    disabled?: boolean;
    isLoading?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      type="submit"
      disabled={disabled || isLoading}
      className="w-full bg-[#024BAB] text-white py-3.5 text-sm font-bold border-2 border-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0a0a0a] transition-all flex items-center justify-center gap-2 mt-2"
    >
      {isLoading ? (
        <>
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Please wait...
        </>
      ) : (
        children
      )}
    </button>
  );

  // ── Back link ──────────────────────────────────────────────────────────────
  const BackLink = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-2 text-xs font-bold text-gray-500 hover:text-black transition-colors"
    >
      ← {label}
    </button>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ──────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#024BAB] flex-col justify-between p-10 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img src={logoimg} alt="NestLeads" className="w-14 h-14 object-contain" />
          <span className="font-display font-bold text-white text-2xl">NestLeads</span>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <h1 className="text-4xl xl:text-5xl font-display font-bold text-white leading-tight mb-5">
            Every lead.
            <br />
            Every follow-up.
            <br />
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
              className="flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2 text-white text-sm font-bold"
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
              className="border-2 border-black bg-white text-black px-3 py-1.5 text-xs font-bold flex items-center gap-2"
            >
              <img src={logo} alt={label} className="w-4 h-4 object-contain rounded-sm" />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ──────────────────────────────────────────── */}
      <div className="flex-1 bg-white flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img src={logoimg} alt="NestLeads" className="w-10 h-10 object-contain" />
            <span className="font-display font-bold text-xl text-black">NestLeads</span>
          </div>

          {/* ── 2FA verification ───────────────────────────────── */}
          {needs2FA ? (
            <>
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheck className="w-7 h-7 text-[#024BAB]" />
                  <h2 className="text-2xl font-display font-bold text-black">
                    Two-Factor Auth
                  </h2>
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>
              <ErrorBanner />
              <form onSubmit={handle2FASubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                    Authenticator Code
                  </label>
                  <input
                    type="text"
                    value={tfaCode}
                    onChange={(e) => {
                      setTfaCode(e.target.value.replace(/\D/g, "").slice(0, 8));
                      setError("");
                    }}
                    placeholder="000000"
                    className="w-full px-4 py-3 border-2 border-black text-lg font-bold tracking-[0.5em] text-center bg-white focus:outline-none focus:border-[#024BAB] transition-colors"
                    autoFocus
                    maxLength={8}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    You can also enter a backup code.
                  </p>
                </div>
                <PrimaryBtn disabled={tfaCode.length < 6} isLoading={loading}>
                  Verify <ArrowRight className="w-4 h-4" />
                </PrimaryBtn>
                <BackLink
                  label="Back to login"
                  onClick={() => {
                    setNeeds2FA(false);
                    setError("");
                    setTfaCode("");
                  }}
                />
              </form>
            </>

          ) : mode === "phone" ? (
            /* ── Phone OTP login ─────────────────────────────────── */
            <>
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <Smartphone className="w-7 h-7 text-[#024BAB]" />
                  <h2 className="text-2xl font-display font-bold text-black">
                    {otpSent ? "Enter OTP" : "Phone Login"}
                  </h2>
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  {otpSent
                    ? "We sent a 6-digit OTP to your WhatsApp."
                    : "We'll send a one-time password to your WhatsApp."}
                </p>
              </div>
              <ErrorBanner />

              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setError(""); }}
                      placeholder="+91 98765 43210"
                      className="w-full px-4 py-3 border-2 border-black text-sm font-medium bg-white focus:outline-none focus:border-[#024BAB] transition-colors"
                      required
                      autoFocus
                    />
                  </div>
                  <PrimaryBtn disabled={!phone.trim()} isLoading={otpLoading}>
                    Send OTP on WhatsApp <ArrowRight className="w-4 h-4" />
                  </PrimaryBtn>
                  <BackLink
                    label="Sign in with Email"
                    onClick={() => { setMode("email"); setError(""); setPhone(""); }}
                  />
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                      WhatsApp OTP
                    </label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                        setError("");
                      }}
                      placeholder="000000"
                      className="w-full px-4 py-3 border-2 border-black text-lg font-bold tracking-[0.5em] text-center bg-white focus:outline-none focus:border-[#024BAB] transition-colors"
                      autoFocus
                      maxLength={6}
                    />
                  </div>
                  <PrimaryBtn disabled={otp.length < 6} isLoading={otpLoading}>
                    Verify OTP <ArrowRight className="w-4 h-4" />
                  </PrimaryBtn>
                  <BackLink
                    label="Change number / Resend"
                    onClick={() => { setOtpSent(false); setOtp(""); setError(""); }}
                  />
                </form>
              )}
            </>

          ) : mode === "passkey" ? (
            /* ── Passkey login ────────────────────────────────────── */
            <>
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <KeyRound className="w-7 h-7 text-[#024BAB]" />
                  <h2 className="text-2xl font-display font-bold text-black">
                    Sign in with Passkey
                  </h2>
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  Use your device's fingerprint, Face ID, or hardware security key.
                </p>
              </div>
              <ErrorBanner />

              <div className="space-y-4">
                {/* Passkey trigger button */}
                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={passkeyLoading}
                  className="w-full bg-[#024BAB] text-white py-3.5 text-sm font-bold border-2 border-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0a0a0a] transition-all flex items-center justify-center gap-2"
                >
                  {passkeyLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Waiting for device...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" /> Continue with Passkey
                    </>
                  )}
                </button>

                {/* Info box */}
                <div className="border-2 border-black/10 p-4 text-xs text-gray-500 space-y-1">
                  <p className="font-bold text-black text-sm">What is a Passkey?</p>
                  <p>Passkeys replace passwords with biometric authentication — fingerprint, Face ID, or a hardware security key. They are phishing-resistant and tied to your device.</p>
                  <p className="mt-2 text-gray-400">You must first register a passkey from your account Settings → Security.</p>
                </div>

                <BackLink
                  label="Back to login"
                  onClick={() => { setMode("email"); setError(""); }}
                />
              </div>
            </>

          ) : (
            /* ── Email / Password login ──────────────────────────── */
            <>
              <div className="mb-8">
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-black">
                  Welcome back
                </h2>
                <p className="text-sm text-gray-500 mt-1 font-medium">
                  Sign in to your workspace
                </p>
              </div>
              <ErrorBanner />

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    placeholder="you@company.com"
                    className="w-full px-4 py-3 border-2 border-black text-sm font-medium bg-white focus:outline-none focus:border-[#024BAB] transition-colors"
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-black uppercase tracking-wider">
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-bold text-[#024BAB] hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="flex border-2 border-black focus-within:border-[#024BAB] transition-colors">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      placeholder="Your password"
                      className="flex-1 px-4 py-3 bg-white text-sm font-medium outline-none"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="px-3 border-l-2 border-black hover:bg-gray-50 transition-colors"
                    >
                      {showPw ? (
                        <EyeOff className="w-4 h-4 text-black" />
                      ) : (
                        <Eye className="w-4 h-4 text-black" />
                      )}
                    </button>
                  </div>
                </div>

                <PrimaryBtn isLoading={loading}>
                  Sign In <ArrowRight className="w-4 h-4" />
                </PrimaryBtn>
              </form>

              {/* Alternative login methods */}
              <div className="mt-6 flex flex-col items-center gap-3">
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-1 h-px bg-black/10" />
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Or continue with
                  </span>
                  <div className="flex-1 h-px bg-black/10" />
                </div>

                <div className="flex gap-3 w-full">
                  {/* Phone OTP */}
                  <button
                    type="button"
                    onClick={() => { setMode("phone"); setError(""); }}
                    className="flex-1 flex items-center justify-center gap-2 border-2 border-black py-2.5 text-xs font-bold text-black hover:bg-gray-50 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#0a0a0a] transition-all"
                  >
                    <Smartphone className="w-4 h-4 text-[#024BAB]" />
                    Phone OTP
                  </button>

                  {/* Passkey */}
                  <button
                    type="button"
                    onClick={() => { setMode("passkey"); setError(""); }}
                    className="flex-1 flex items-center justify-center gap-2 border-2 border-black py-2.5 text-xs font-bold text-black hover:bg-gray-50 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#0a0a0a] transition-all"
                  >
                    <KeyRound className="w-4 h-4 text-[#024BAB]" />
                    Passkey
                  </button>
                </div>
              </div>

              {/* Register link */}
              <div className="mt-6 pt-6 border-t-2 border-black/10 text-center">
                <p className="text-xs text-gray-500">
                  New to NestLeads?{" "}
                  <Link
                    to="/register"
                    className="font-bold text-[#024BAB] hover:underline transition-colors"
                  >
                    Create an account
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
