import { useEffect, useState } from "react";
import { Check, RefreshCw, ExternalLink, Copy } from "lucide-react";
import { googleAdsAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";

type Step = "login" | "select_account" | "select_campaigns" | "done";

interface GoogleAdsWizardProps {
  onClose: () => void;
  onConnected: () => void;
  startAtStep?: Step;
}

export function GoogleAdsWizard({
  onClose,
  onConnected,
  startAtStep = "login",
}: GoogleAdsWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(startAtStep);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<
    { id: string; name: string; error?: string }[]
  >([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedAccountName, setSelectedAccountName] = useState("");
  const [campaigns, setCampaigns] = useState<
    { id: string; name: string; status: string }[]
  >([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [allowedStatesInput, setAllowedStatesInput] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    if (step === "select_account") {
      setLoading(true);
      googleAdsAPI
        .getAccounts()
        .then((res) => setAccounts(res.data || []))
        .catch((err) =>
          toast({
            title: "Failed to load Google Ads accounts",
            description: err.message,
            variant: "destructive",
          }),
        )
        .finally(() => setLoading(false));
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await googleAdsAPI.getAuthUrl();
      window.location.href = res.data.authUrl;
    } catch (err: any) {
      toast({
        title: "Could not start Google login",
        description: err.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handlePickAccount = async (id: string, name: string) => {
    setSelectedAccountId(id);
    setSelectedAccountName(name);
    setLoading(true);
    try {
      const res = await googleAdsAPI.getCampaigns(id);
      setCampaigns(res.data || []);
      setStep("select_campaigns");
    } catch (err: any) {
      toast({
        title: "Failed to load campaigns",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCampaign = (id: string) => {
    setSelectedCampaignIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const handleSaveConnection = async () => {
    setLoading(true);
    try {
      const allowedStates = allowedStatesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await googleAdsAPI.connectAccount(
        selectedAccountId,
        selectedAccountName,
        selectedCampaignIds,
        allowedStates,
      );
      setWebhookUrl(res.data.webhookUrl);
      setStep("done");
      onConnected();
    } catch (err: any) {
      toast({
        title: "Failed to connect Google Ads",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-5 border-b-2 border-black">
        <div>
          <h2 className="text-lg font-bold">Google Ads Lead Forms</h2>
          <p className="text-xs text-black/60">
            Capture leads from Google Ads Lead Form Extensions
          </p>
        </div>
        <button onClick={onClose} className="nb-btn px-3 py-1.5 text-sm">
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {step === "login" && (
          <div className="border-2 border-black nb-shadow-sm p-6 text-center space-y-4">
            <p className="text-sm">
              Connect your Google account to pull leads submitted through your
              Google Ads Lead Form Extensions.
            </p>
            <button
              onClick={handleConnect}
              disabled={loading}
              className="nb-btn px-6 py-2.5 text-sm font-bold bg-[#4285F4] text-white border-black"
            >
              {loading ? "Redirecting…" : "Connect with Google →"}
            </button>
          </div>
        )}

        {step === "select_account" && (
          <div className="space-y-3">
            <p className="text-sm font-bold">Choose a Google Ads account</p>
            {loading && (
              <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
            )}
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => handlePickAccount(a.id, a.name)}
                className="w-full text-left border-2 border-black nb-shadow-sm p-4 hover:bg-black/5 flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-sm">{a.name}</p>
                  <p className="text-xs text-black/60">Customer ID: {a.id}</p>
                </div>
                <ExternalLink className="w-4 h-4" />
              </button>
            ))}
            {!loading && accounts.length === 0 && (
              <p className="text-xs text-black/60">
                No accessible Google Ads accounts found for this login.
              </p>
            )}
          </div>
        )}

        {step === "select_campaigns" && (
          <div className="space-y-4">
            <p className="text-sm font-bold">
              Select campaigns to sync leads from (leave empty to sync all)
            </p>
            <div className="border-2 border-black nb-shadow-sm divide-y-2 divide-black max-h-64 overflow-y-auto">
              {campaigns.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-black/5"
                >
                  <input
                    type="checkbox"
                    checked={selectedCampaignIds.includes(c.id)}
                    onChange={() => toggleCampaign(c.id)}
                  />
                  <span className="text-sm">{c.name}</span>
                  <span className="text-xs text-black/50 ml-auto">
                    {c.status}
                  </span>
                </label>
              ))}
              {campaigns.length === 0 && (
                <p className="text-xs text-black/60 p-3">
                  No campaigns found on this account.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">
                Allowed States (optional — comma separated, filters leads by
                location)
              </label>
              <input
                type="text"
                value={allowedStatesInput}
                onChange={(e) => setAllowedStatesInput(e.target.value)}
                placeholder="e.g. Maharashtra, Gujarat"
                className="w-full border-2 border-black p-2 text-sm"
              />
            </div>

            <button
              onClick={handleSaveConnection}
              disabled={loading}
              className="nb-btn px-6 py-2.5 text-sm font-bold bg-[#4285F4] text-white border-black"
            >
              {loading ? "Saving…" : "Save & Connect →"}
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-[#4285F4]/10 border-2 border-black flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-[#4285F4]" />
            </div>
            <p className="font-bold">Google Ads connected!</p>
            <p className="text-sm text-black/70">
              We'll sync leads periodically. For instant delivery, add this
              webhook URL to your Lead Form asset's webhook delivery settings
              in Google Ads.
            </p>
            {webhookUrl && (
              <div className="flex items-center gap-2 border-2 border-black p-3 nb-shadow-sm text-xs font-mono break-all">
                {webhookUrl}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast({ title: "Copied to clipboard" });
                  }}
                >
                  <Copy className="w-4 h-4 shrink-0" />
                </button>
              </div>
            )}
            <button onClick={onClose} className="nb-btn px-6 py-2.5 text-sm font-bold">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
