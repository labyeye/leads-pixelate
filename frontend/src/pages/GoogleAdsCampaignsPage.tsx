import { AppLayout } from "@/components/layout/AppLayout";
import { googleAdsAPI, usersAPI, leadsAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { GoogleAdsIcon } from "@/components/icons/GoogleAdsIcon";
import { AssigneePicker, describeAssignment } from "@/components/integrations/AssigneePicker";
import {
  RefreshCw,
  Check,
  Trash2,
  Users,
  Megaphone,
  UserCheck,
  MapPin,
  Loader2,
  Plus,
  X,
  AlertCircle,
} from "lucide-react";

interface ConnectedAccount {
  customerId: string;
  customerName: string;
  selectedCampaignIds: string[];
  allowedStates: string[];
  defaultAssigneeId: string;
  assigneeIds?: string[];
  assignBatchSize?: number;
  connectedAt: string;
}

export default function GoogleAdsCampaignsPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [hasToken, setHasToken] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<
    ConnectedAccount[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [leadCount, setLeadCount] = useState(0);

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [campaigns, setCampaigns] = useState<
    { id: string; name: string; status: string }[]
  >([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [allCampaigns, setAllCampaigns] = useState(true);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(
    new Set(),
  );
  const [allowedStates, setAllowedStates] = useState<string[]>([]);
  const [stateInput, setStateInput] = useState("");
  const [users, setUsers] = useState<{ _id: string; name: string; role: string }[]>(
    [],
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assignBatchSize, setAssignBatchSize] = useState(1);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const loadConnected = useCallback(async () => {
    setLoading(true);
    try {
      const res = await googleAdsAPI.getConnectedAccounts();
      setConnectedAccounts(res.data || []);
      setHasToken(res.hasToken);
    } catch {
      // not connected yet
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLeadCount = useCallback(async () => {
    try {
      const res = await leadsAPI.getAll({ source: "Google Ads", limit: "1" });
      setLeadCount(res.count || 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadConnected();
    loadLeadCount();
    usersAPI
      .getAll()
      .then((res) => setUsers(res.data || []))
      .catch(() => {});
  }, [loadConnected, loadLeadCount]);

  useEffect(() => {
    const err = searchParams.get("gads_error");
    const step = searchParams.get("gads_step");
    if (err) {
      toast({
        title: "Google Ads connection failed",
        description: err.replace(/_/g, " "),
        variant: "destructive",
      });
      setSearchParams({}, { replace: true });
    } else if (step === "select_account") {
      setHasToken(true);
      setShowAddAccount(true);
      loadAccounts();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAccounts = async () => {
    setAccountsLoading(true);
    try {
      const res = await googleAdsAPI.getAccounts();
      setAccounts(res.data || []);
    } catch (err: any) {
      toast({
        title: "Could not load Google Ads accounts",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadCampaigns = async (customerId: string) => {
    setCampaignsLoading(true);
    setCampaigns([]);
    try {
      const res = await googleAdsAPI.getCampaigns(customerId);
      setCampaigns(res.data || []);
    } catch (err: any) {
      toast({
        title: "Could not load campaigns",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setCampaignsLoading(false);
    }
  };

  const handleLogin = async () => {
    setOauthLoading(true);
    try {
      const res = await googleAdsAPI.getAuthUrl();
      window.location.href = res.data.authUrl;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Could not get Google login URL",
        variant: "destructive",
      });
      setOauthLoading(false);
    }
  };

  const toggleCampaign = (id: string) => {
    setSelectedCampaignIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const resetAddAccountForm = () => {
    setSelectedAccountId("");
    setCampaigns([]);
    setAllCampaigns(true);
    setSelectedCampaignIds(new Set());
    setAllowedStates([]);
    setStateInput("");
    setAssigneeIds([]);
    setAssignBatchSize(1);
  };

  const handleConnectAccount = async () => {
    const account = accounts.find((a) => a.id === selectedAccountId);
    if (!account) return;
    setConnecting(true);
    try {
      await googleAdsAPI.connectAccount(
        account.id,
        account.name,
        allCampaigns ? [] : [...selectedCampaignIds],
        allowedStates,
        "",
        "",
        { assigneeIds, assignBatchSize },
      );
      toast({
        title: "Google Ads account connected!",
        description: `${account.name} is now syncing leads.`,
      });
      setShowAddAccount(false);
      resetAddAccountForm();
      loadConnected();
    } catch (err: any) {
      toast({
        title: "Connection failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async (customerId: string) => {
    setSyncing(customerId);
    try {
      const res = await googleAdsAPI.sync(customerId);
      toast({ title: "Sync complete", description: res.message });
      loadLeadCount();
    } catch (err: any) {
      toast({
        title: "Sync failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (customerId: string) => {
    setDisconnecting(customerId);
    try {
      await googleAdsAPI.disconnect(customerId);
      setConnectedAccounts((prev) =>
        prev.filter((a) => a.customerId !== customerId),
      );
      toast({ title: "Account disconnected" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <AppLayout title="Campaigns">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-black">
            Google Ads Campaigns
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            Connect Google Ads accounts and lead-form campaigns
          </p>
        </div>
        <button
          onClick={loadConnected}
          disabled={loading}
          className="border-2 border-black bg-white text-black px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-[#4285F4]/10 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !hasToken ? (
        <div className="border-2 bg-white p-8 max-w-lg mx-auto text-center space-y-4">
          <div className="w-14 h-14 bg-white border-2 border-black flex items-center justify-center mx-auto">
            <GoogleAdsIcon className="w-9 h-9" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-black">
              Connect Google Ads
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Leads from your Google Ads Lead Form campaigns will flow into
              NestLeads automatically.
            </p>
          </div>
          <div className="text-left border-2 border-black p-4 bg-[#4285F4]/10">
            <p className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Before connecting
            </p>
            <ul className="space-y-1.5 text-xs text-black">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#00C48C]" />
                Admin access to a Google Ads account
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#00C48C]" />
                At least one Lead Form campaign created on that account
              </li>
            </ul>
          </div>
          <button
            onClick={handleLogin}
            disabled={oauthLoading}
            className="w-full border-2 border-black bg-[#4285F4] text-white py-3 font-bold text-sm flex items-center justify-center gap-2"
          >
            {oauthLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <div className="w-5 h-5 bg-white flex items-center justify-center shrink-0">
                <GoogleAdsIcon className="w-4 h-4" />
              </div>
            )}
            {oauthLoading ? "Opening Google…" : "Connect with Google"}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <KpiCard
              title="Google Ads Leads"
              value={leadCount}
              sub="All time"
              icon={Users}
              bg="bg-[#4285F4]"
            />
            <KpiCard
              title="Connected Accounts"
              value={connectedAccounts.length}
              sub="Ad accounts syncing"
              icon={GoogleAdsIcon}
              bg="bg-white"
            />
          </div>

          <div className="border-2 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-display font-bold text-base text-black">
                  Connected Ad Accounts
                </h3>
                <p className="text-xs text-muted-foreground">
                  {connectedAccounts.length} connected
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddAccount((v) => !v);
                  if (!showAddAccount) loadAccounts();
                }}
                className="border-2 border-black px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 hover:bg-[#4285F4]/10 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Account
              </button>
            </div>

            {connectedAccounts.length === 0 && !showAddAccount && (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center border-2 border-dashed border-black bg-[#fafafa]">
                <GoogleAdsIcon className="w-8 h-8 opacity-40" />
                <p className="text-sm font-bold">No accounts connected yet</p>
                <p className="text-xs text-muted-foreground">
                  Add an account to start pulling in Google Ads leads.
                </p>
              </div>
            )}

            <div className="space-y-2.5">
              {connectedAccounts.map((a) => (
                <div
                  key={a.customerId}
                  className="border-2 border-black p-3 flex items-center gap-3"
                >
                  <div className="w-9 h-9 bg-white border-2 border-black flex items-center justify-center shrink-0">
                    <GoogleAdsIcon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-black truncate">
                      {a.customerName || a.customerId}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="flex items-center gap-1">
                        <Megaphone className="w-3 h-3" />
                        {a.selectedCampaignIds?.length
                          ? `${a.selectedCampaignIds.length} campaign(s)`
                          : "All campaigns"}
                      </span>
                      {a.allowedStates?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {a.allowedStates.join(", ")}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        {describeAssignment(a, users, "Auto-assign")}
                      </span>
                    </p>
                  </div>
                  <button
                    disabled={syncing === a.customerId}
                    onClick={() => handleSync(a.customerId)}
                    className="border-2 border-black p-1.5 hover:bg-blue-50 transition-colors"
                    title="Sync leads now"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-[#4285F4] ${syncing === a.customerId ? "animate-spin" : ""}`}
                    />
                  </button>
                  <button
                    disabled={disconnecting === a.customerId}
                    onClick={() => handleDisconnect(a.customerId)}
                    className="border-2 border-black p-1.5 hover:bg-red-50 transition-colors"
                    title="Disconnect"
                  >
                    {disconnecting === a.customerId ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            {showAddAccount && (
              <div className="border-t-2 border-black mt-4 pt-4 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-1.5">
                    Ad Account
                  </p>
                  {accountsLoading ? (
                    <div className="h-10 border-2 border-black bg-[#F9FAFB] animate-pulse" />
                  ) : (
                    <select
                      value={selectedAccountId}
                      onChange={(e) => {
                        setSelectedAccountId(e.target.value);
                        setAllCampaigns(true);
                        setSelectedCampaignIds(new Set());
                        if (e.target.value) loadCampaigns(e.target.value);
                      }}
                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white"
                    >
                      <option value="">— Select an ad account —</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedAccountId && (
                  <>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide mb-1.5">
                        Campaigns
                      </p>
                      <button
                        onClick={() => {
                          setAllCampaigns(true);
                          setSelectedCampaignIds(new Set());
                        }}
                        className={`w-full border-2 border-black p-2.5 flex items-center gap-2 text-left mb-2 ${allCampaigns ? "bg-[#4285F4]/10" : "bg-white"}`}
                      >
                        <div
                          className={`w-5 h-5 border-2 border-black flex items-center justify-center shrink-0 ${allCampaigns ? "bg-[#4285F4]" : "bg-white"}`}
                        >
                          {allCampaigns && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm font-bold">
                          Capture from all campaigns
                        </span>
                      </button>
                      {campaignsLoading ? (
                        <div className="h-10 border-2 border-black bg-[#F9FAFB] animate-pulse" />
                      ) : (
                        <div className="space-y-1.5">
                          {campaigns.map((c) => {
                            const sel = selectedCampaignIds.has(c.id);
                            return (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setAllCampaigns(false);
                                  toggleCampaign(c.id);
                                }}
                                className={`w-full border-2 border-black p-2 flex items-center gap-2 text-left ${!allCampaigns && sel ? "bg-[#4285F4]/10" : "bg-white"} ${allCampaigns ? "opacity-50" : ""}`}
                              >
                                <div
                                  className={`w-4 h-4 border-2 border-black flex items-center justify-center shrink-0 ${!allCampaigns && sel ? "bg-[#4285F4]" : "bg-white"}`}
                                >
                                  {!allCampaigns && sel && (
                                    <Check className="w-2.5 h-2.5 text-white" />
                                  )}
                                </div>
                                <span className="text-xs font-semibold truncate flex-1">
                                  {c.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {c.status}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide mb-1.5">
                        Location Filter (optional)
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={stateInput}
                          onChange={(e) => setStateInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault();
                              const val = stateInput.trim();
                              if (val && !allowedStates.includes(val)) {
                                setAllowedStates((p) => [...p, val]);
                              }
                              setStateInput("");
                            }
                          }}
                          placeholder="Type state/city, press Enter"
                          className="flex-1 border-2 border-black px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => {
                            const val = stateInput.trim();
                            if (val && !allowedStates.includes(val)) {
                              setAllowedStates((p) => [...p, val]);
                            }
                            setStateInput("");
                          }}
                          className="border-2 border-black px-3 py-2 bg-black text-white text-sm font-bold"
                        >
                          Add
                        </button>
                      </div>
                      {allowedStates.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {allowedStates.map((s) => (
                            <span
                              key={s}
                              className="flex items-center gap-1 border-2 border-black px-2 py-0.5 bg-[#4285F4]/10 text-xs font-bold"
                            >
                              {s}
                              <button
                                onClick={() =>
                                  setAllowedStates((p) =>
                                    p.filter((x) => x !== s),
                                  )
                                }
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide mb-1.5">
                        Assign Leads To
                      </p>
                      <AssigneePicker
                        users={users}
                        assigneeIds={assigneeIds}
                        onAssigneeIdsChange={setAssigneeIds}
                        batchSize={assignBatchSize}
                        onBatchSizeChange={setAssignBatchSize}
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleConnectAccount}
                    disabled={
                      !selectedAccountId ||
                      connecting ||
                      (!allCampaigns && selectedCampaignIds.size === 0)
                    }
                    className="border-2 border-black px-4 py-2 bg-[#00C48C] text-black text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {connecting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Connect Account
                  </button>
                  <button
                    onClick={() => {
                      setShowAddAccount(false);
                      resetAddAccountForm();
                    }}
                    className="border-2 border-black px-4 py-2 bg-white text-black text-sm font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
}
