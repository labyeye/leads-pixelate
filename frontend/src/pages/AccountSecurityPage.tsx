import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI, settingsAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  KeyRound,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  ShieldOff,
  Lock,
  Save,
} from "lucide-react";

export default function AccountSecurityPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Phone verification
  const [phone, setPhone] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);

  // TOTP
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<{
    qrCode: string;
    secret: string;
  } | null>(null);
  const [totpToken, setTotpToken] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    authAPI
      .getMe()
      .then((res) => {
        setPhoneVerified(!!res.data.phoneVerified);
        setTotpEnabled(!!res.data.totpEnabled);
        if (res.data.phone) {
          setPhone(res.data.phone);
          setSavedPhone(res.data.phone);
        } else {
          // No personal number saved yet — prefill from the company phone in
          // Settings so there's a sensible starting point; still per-user
          // and editable/verified independently below.
          settingsAPI
            .get()
            .then((s) => {
              if (s.data?.companyPhone) setPhone(s.data.companyPhone);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const handleSavePhone = async () => {
    setPhoneSaving(true);
    try {
      await authAPI.updateProfile({ phone });
      if (phone !== savedPhone) setPhoneVerified(false);
      setSavedPhone(phone);
      toast({ title: "Phone number saved" });
    } catch (err: any) {
      toast({
        title: "Failed to save phone number",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setPhoneSaving(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    setPhoneLoading(true);
    try {
      await authAPI.sendPhoneOtp();
      setPhoneOtpSent(true);
      toast({ title: "Code sent via WhatsApp" });
    } catch (err: any) {
      toast({
        title: "Failed to send code",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    setPhoneLoading(true);
    try {
      await authAPI.verifyPhoneOtp(phoneOtp);
      setPhoneVerified(true);
      setPhoneOtpSent(false);
      setPhoneOtp("");
      toast({ title: "Phone number verified" });
    } catch (err: any) {
      toast({
        title: "Verification failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleStartTotpSetup = async () => {
    setTotpLoading(true);
    try {
      const res = await authAPI.totpSetup();
      setTotpSetupData(res.data);
    } catch (err: any) {
      toast({
        title: "Setup failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setTotpLoading(false);
    }
  };

  const handleVerifyTotp = async () => {
    setTotpLoading(true);
    try {
      await authAPI.totpVerifySetup(totpToken);
      setTotpEnabled(true);
      setTotpSetupData(null);
      setTotpToken("");
      toast({ title: "Authenticator app enabled" });
    } catch (err: any) {
      toast({
        title: "Invalid code",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setTotpLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "New password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        variant: "destructive",
      });
      return;
    }
    setPwLoading(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      toast({ title: "Password updated" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({
        title: "Failed to update password",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setPwLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    setTotpLoading(true);
    try {
      await authAPI.totpDisable();
      setTotpEnabled(false);
      toast({ title: "Authenticator app disabled" });
    } catch (err: any) {
      toast({
        title: "Failed to disable",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setTotpLoading(false);
    }
  };

  return (
    <AppLayout title="Security">
      <div>
        <div className="mb-5">
          <h2 className="font-display font-bold text-2xl text-black">
            Account Security
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            Set these up so you have more ways to reset your password than
            just email.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {}
        {(
          <div className="border-2 bg-white p-5 flex flex-col">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 border-2 border-black bg-[#FA731C]/10 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-[#FA731C]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-base text-black">
                  Reset Password
                </h3>
                <p className="text-xs text-muted-foreground">
                  Change your account password
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full border-2 border-black px-3 py-2 text-sm"
                required
                autoComplete="current-password"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                className="w-full border-2 border-black px-3 py-2 text-sm"
                required
                autoComplete="new-password"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full border-2 border-black px-3 py-2 text-sm"
                required
                autoComplete="new-password"
              />
              <button
                type="submit"
                disabled={pwLoading}
                className="border-2 border-black px-4 py-2 bg-[#FA731C] text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {pwLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Update Password
              </button>
            </form>
          </div>
        )}

        {}
        {(
          <div className="border-2 bg-white p-5 flex flex-col">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 border-2 border-black bg-[#25D366]/10 flex items-center justify-center shrink-0">
                <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-base text-black">
                  WhatsApp Verification
                </h3>
                <p className="text-xs text-muted-foreground">
                  Your own WhatsApp number, used to receive reset codes
                </p>
              </div>
              {phoneVerified && (
                <span className="nb-badge nb-tag-lime flex items-center gap-0.5 text-[10px] shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <PhoneInput
                    label="Phone number"
                    value={phone}
                    onChange={(v) => {
                      setPhone(v);
                      setPhoneOtpSent(false);
                    }}
                  />
                </div>
                <button
                  onClick={handleSavePhone}
                  disabled={phoneSaving || !phone || phone === savedPhone}
                  className="border-2 border-black px-3 py-2 bg-white text-black text-sm font-bold flex items-center gap-1.5 disabled:opacity-50 h-[38px]"
                >
                  {phoneSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save
                </button>
              </div>

              {!phoneVerified && savedPhone && (
                <>
                  {!phoneOtpSent ? (
                    <button
                      onClick={handleSendPhoneOtp}
                      disabled={phoneLoading}
                      className="border-2 border-black px-4 py-2 bg-[#25D366]/10 text-black text-sm font-bold flex items-center gap-1.5"
                    >
                      {phoneLoading && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      Send verification code
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={phoneOtp}
                        onChange={(e) =>
                          setPhoneOtp(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="6-digit code"
                        className="border-2 border-black px-3 py-2 text-sm font-bold tracking-widest"
                      />
                      <button
                        onClick={handleVerifyPhoneOtp}
                        disabled={phoneLoading || phoneOtp.length !== 6}
                        className="border-2 border-black px-4 py-2 bg-[#00C48C] text-black text-sm font-bold disabled:opacity-50"
                      >
                        Verify
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {}
        {(
          <div className="border-2 bg-white p-5 flex flex-col">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 border-2 border-black bg-[#024BAB]/10 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-[#024BAB]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-base text-black">
                  Authenticator App
                </h3>
                <p className="text-xs text-muted-foreground">
                  Google Authenticator, Authy, or similar
                </p>
              </div>
              {totpEnabled && (
                <span className="nb-badge nb-tag-lime flex items-center gap-0.5 text-[10px] shrink-0">
                  <ShieldCheck className="w-2.5 h-2.5" /> Enabled
                </span>
              )}
            </div>

            {totpEnabled ? (
              <button
                onClick={handleDisableTotp}
                disabled={totpLoading}
                className="border-2 border-black px-4 py-2 bg-white text-red-600 text-sm font-bold flex items-center gap-1.5"
              >
                {totpLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldOff className="w-4 h-4" />
                )}
                Disable
              </button>
            ) : !totpSetupData ? (
              <button
                onClick={handleStartTotpSetup}
                disabled={totpLoading}
                className="border-2 border-black px-4 py-2 bg-[#024BAB]/10 text-black text-sm font-bold flex items-center gap-1.5"
              >
                {totpLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Set up authenticator app
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Scan this QR code with your authenticator app, then enter
                  the 6-digit code it shows.
                </p>
                <img
                  src={totpSetupData.qrCode}
                  alt="TOTP QR code"
                  className="w-40 h-40 border-2 border-black"
                />
                <p className="text-[11px] text-muted-foreground">
                  Can't scan? Enter this key manually:{" "}
                  <code className="bg-[#F3F4F6] border border-black px-1.5 py-0.5">
                    {totpSetupData.secret}
                  </code>
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpToken}
                    onChange={(e) =>
                      setTotpToken(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="6-digit code"
                    className="border-2 border-black px-3 py-2 text-sm font-bold tracking-widest"
                  />
                  <button
                    onClick={handleVerifyTotp}
                    disabled={totpLoading || totpToken.length !== 6}
                    className="border-2 border-black px-4 py-2 bg-[#00C48C] text-black text-sm font-bold disabled:opacity-50"
                  >
                    Verify & Enable
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </AppLayout>
  );
}
