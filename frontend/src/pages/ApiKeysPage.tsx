import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiKeysAPI } from "@/services/api";
import { Copy, Plus, Trash2, Key, CheckCircle, Clock } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

const BACKEND_URL =
  import.meta.env.VITE_API_URL?.replace("/api", "") ||
  "https://leads-backend.pixelatenest.com";

export default function ApiKeysPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedKeyName, setRevealedKeyName] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"keys" | "docs">("keys");

  const { data, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => apiKeysAPI.list(),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => apiKeysAPI.generate(name),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setShowCreate(false);
      setNewKeyName("");
      setRevealedKey(res.data.key);
      setRevealedKeyName(res.data.name);
    },
    onError: (err: any) => toast.error(err.message || "Failed to create key"),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiKeysAPI.revoke(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setRevokeTarget(null);
      toast.success("API key revoked");
    },
    onError: (err: any) => toast.error(err.message || "Failed to revoke key"),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const keys: ApiKey[] = data?.data || [];
  const activeKeys = keys.filter((k) => k.active);

  const snippetHtml = `<!-- NestLeads Lead Form -->
<form id="nl-lead-form">
  <input name="name" placeholder="Your Name" required />
  <input name="phone" placeholder="Phone Number" required />
  <input name="company" placeholder="Company Name" required />
  <input name="email" placeholder="Email (optional)" />
  <textarea name="requirement" placeholder="Your Requirement" required></textarea>
  <button type="submit">Submit Enquiry</button>
</form>

<script>
document.getElementById('nl-lead-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Submitting...';
  try {
    const res = await fetch('${BACKEND_URL}/api/public/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'YOUR_API_KEY_HERE'
      },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (json.success) {
      btn.textContent = 'Submitted!';
      e.target.reset();
    } else {
      btn.textContent = 'Submit Enquiry';
      btn.disabled = false;
      alert(json.message || 'Something went wrong. Please try again.');
    }
  } catch (err) {
    btn.textContent = 'Submit Enquiry';
    btn.disabled = false;
    alert('Network error. Please try again.');
  }
});
</script>`;

  const snippetCurl = `curl -X POST ${BACKEND_URL}/api/public/leads \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY_HERE" \\
  -d '{
    "name": "Rahul Sharma",
    "phone": "9876543210",
    "company": "ABC Pvt Ltd",
    "email": "rahul@abc.com",
    "requirement": "Looking for ERP software"
  }'`;

  return (
    <AppLayout title="API Keys">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">API Keys</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate secret keys to receive leads from your website forms directly into this CRM.
            </p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-[#024BAB] text-white border-2 border-black nb-shadow hover:bg-[#013a87] gap-2"
          >
            <Plus className="w-4 h-4" />
            Generate New Key
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b-2 border-black">
          {(["keys", "docs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold border-2 border-b-0 transition-colors ${
                activeTab === tab
                  ? "bg-[#024BAB] text-white border-black"
                  : "border-transparent text-black hover:bg-[#024BAB]/10"
              }`}
            >
              {tab === "keys" ? "Your API Keys" : "Integration Guide"}
            </button>
          ))}
        </div>

        {activeTab === "keys" && (
          <div className="space-y-4">
            {/* Endpoint info */}
            <div className="border-2 border-black bg-zinc-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Public Endpoint</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-black flex-1 break-all">
                  POST {BACKEND_URL}/api/public/leads
                </code>
                <button
                  onClick={() => copyToClipboard(`${BACKEND_URL}/api/public/leads`)}
                  className="p-1.5 border border-black hover:bg-[#024BAB]/10"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Keys list */}
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
            ) : activeKeys.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-black">
                <Key className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-semibold text-black">No API keys yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Generate your first key to start receiving leads from your website.
                </p>
              </div>
            ) : (
              <div className="border-2 border-black divide-y-2 divide-black">
                {activeKeys.map((key) => (
                  <div key={key.id} className="flex items-center gap-4 p-4">
                    <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0">
                      <Key className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-black text-sm">{key.name}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">
                        {key.keyPrefix}••••••••••••••••••••••••••••••••••••••
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          Created {new Date(key.createdAt).toLocaleDateString("en-IN")}
                        </span>
                        {key.lastUsedAt && (
                          <span className="text-xs text-muted-foreground">
                            Last used {new Date(key.lastUsedAt).toLocaleDateString("en-IN")}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevokeTarget(key)}
                      className="text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "docs" && (
          <div className="space-y-6">
            <div className="border-2 border-black p-5 space-y-3">
              <h2 className="font-bold text-black">How it works</h2>
              <ol className="space-y-2 text-sm text-black list-decimal list-inside">
                <li>Generate an API key from the "Your API Keys" tab above.</li>
                <li>Copy the secret key — it is shown <strong>only once</strong>.</li>
                <li>Paste the HTML snippet below into your website and replace <code className="bg-zinc-100 px-1">YOUR_API_KEY_HERE</code> with your secret key.</li>
                <li>When a visitor submits the form, a lead is automatically created in your CRM with source <strong>Website</strong>.</li>
              </ol>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-black uppercase tracking-wider">HTML + JavaScript Snippet</p>
                <button
                  onClick={() => { copyToClipboard(snippetHtml); toast.success("Copied!"); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 border-2 border-black bg-white hover:bg-[#024BAB]/10 font-semibold"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
              <pre className="bg-zinc-900 text-zinc-100 text-xs p-4 border-2 border-black overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                {snippetHtml}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-black uppercase tracking-wider">cURL Example</p>
                <button
                  onClick={() => { copyToClipboard(snippetCurl); toast.success("Copied!"); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 border-2 border-black bg-white hover:bg-[#024BAB]/10 font-semibold"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
              <pre className="bg-zinc-900 text-zinc-100 text-xs p-4 border-2 border-black overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                {snippetCurl}
              </pre>
            </div>

            <div className="border-2 border-black p-5 space-y-3">
              <h2 className="font-bold text-black">Required Fields</h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-black">
                    <th className="text-left py-2 pr-4 font-bold">Field</th>
                    <th className="text-left py-2 pr-4 font-bold">Type</th>
                    <th className="text-left py-2 font-bold">Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {[
                    { field: "name", type: "string", req: "Yes" },
                    { field: "phone", type: "string", req: "Yes" },
                    { field: "company", type: "string", req: "Yes" },
                    { field: "requirement", type: "string", req: "Yes" },
                    { field: "email", type: "string", req: "No" },
                  ].map((row) => (
                    <tr key={row.field}>
                      <td className="py-2 pr-4 font-mono text-xs">{row.field}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.type}</td>
                      <td className="py-2">
                        <span className={`text-xs font-semibold ${row.req === "Yes" ? "text-red-600" : "text-muted-foreground"}`}>
                          {row.req}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Key Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-2 border-black">
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm font-semibold text-black">Key Name</label>
            <Input
              placeholder="e.g. Website Form, Landing Page"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="border-2 border-black"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newKeyName.trim()) {
                  createMutation.mutate(newKeyName.trim());
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Give the key a label so you remember where it's used.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-2 border-black">
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(newKeyName.trim())}
              disabled={!newKeyName.trim() || createMutation.isPending}
              className="bg-[#024BAB] text-white border-2 border-black hover:bg-[#013a87]"
            >
              {createMutation.isPending ? "Generating..." : "Generate Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal Key Dialog (shown only once after creation) */}
      <Dialog open={!!revealedKey} onOpenChange={() => setRevealedKey(null)}>
        <DialogContent className="border-2 border-black">
          <DialogHeader>
            <DialogTitle>Your New API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-amber-50 border-2 border-amber-400 p-3 text-sm font-semibold text-amber-800">
              Copy this key now. For security, it will NOT be shown again.
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 font-semibold">{revealedKeyName}</p>
              <div className="flex items-center gap-2 border-2 border-black p-3 bg-zinc-50">
                <code className="text-xs font-mono flex-1 break-all">{revealedKey}</code>
                <button
                  onClick={() => {
                    copyToClipboard(revealedKey!);
                    toast.success("Copied to clipboard");
                  }}
                  className="p-1.5 border border-black hover:bg-[#024BAB]/10 shrink-0"
                >
                  {copied ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Use this key in the <code className="bg-zinc-100 px-1">X-API-Key</code> header when calling the public endpoint.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setRevealedKey(null)}
              className="bg-[#024BAB] text-white border-2 border-black hover:bg-[#013a87]"
            >
              I've saved the key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirm Dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent className="border-2 border-black">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{revokeTarget?.name}</strong> will be permanently revoked. Any website or service using this key will stop receiving leads. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-2 border-black">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget.id)}
              className="bg-red-600 text-white border-2 border-black hover:bg-red-700"
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
