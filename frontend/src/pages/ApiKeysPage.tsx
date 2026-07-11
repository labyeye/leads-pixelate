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
import {
  Copy,
  Plus,
  Trash2,
  Key,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Lock,
  Shield,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FieldConfig {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  fields: FieldConfig[];
  createdAt: string;
  lastUsedAt: string | null;
}

// ─── Available form fields the owner can add ─────────────────────────────────

const AVAILABLE_FIELDS: {
  key: string;
  label: string;
  type: string;
  defaultLabel: string;
}[] = [
  {
    key: "company",
    label: "Company Name",
    type: "text",
    defaultLabel: "Company / Organisation",
  },
  {
    key: "email",
    label: "Email Address",
    type: "email",
    defaultLabel: "Email Address",
  },
  {
    key: "requirement",
    label: "Requirement",
    type: "textarea",
    defaultLabel: "Your Requirement",
  },
  {
    key: "budget",
    label: "Budget",
    type: "text",
    defaultLabel: "Approximate Budget",
  },
  {
    key: "location",
    label: "City / Location",
    type: "text",
    defaultLabel: "City / Location",
  },
  {
    key: "product",
    label: "Interested Products",
    type: "text",
    defaultLabel: "Products of Interest",
  },
];

const FIXED_FIELDS = [
  { key: "name", label: "Full Name", type: "text", note: "Always collected" },
  {
    key: "phone",
    label: "Phone Number",
    type: "tel",
    note: "Always collected",
  },
];

const BACKEND_URL =
  import.meta.env.VITE_API_URL?.replace("/api", "") ||
  "https://leads-backend.pixelatenest.com";

// ─── Snippet generator ───────────────────────────────────────────────────────

function buildSnippet(fields: FieldConfig[], revealedKey?: string): string {
  const allFields: {
    key: string;
    label: string;
    type: string;
    required: boolean;
  }[] = [
    { key: "name", label: "Full Name", type: "text", required: true },
    { key: "phone", label: "Phone Number", type: "tel", required: true },
    ...fields,
  ];

  const inputsHtml = allFields
    .map((f) => {
      const req = f.required ? " required" : "";
      if (f.type === "textarea") {
        return `  <textarea name="${f.key}" placeholder="${f.label}"${req}></textarea>`;
      }
      return `  <input name="${f.key}" type="${f.type}" placeholder="${f.label}"${req} />`;
    })
    .join("\n");

  const apiKey = revealedKey || "YOUR_API_KEY_HERE";

  return `<!-- NestLeads Lead Capture Form -->
<form id="nl-lead-form">
${inputsHtml}
  <button type="submit">Submit Enquiry</button>
</form>

<script>
document.getElementById('nl-lead-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var data = Object.fromEntries(new FormData(e.target));
  var btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Submitting...';
  try {
    var res = await fetch('${BACKEND_URL}/api/public/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': '${apiKey}'
      },
      body: JSON.stringify(data)
    });
    var json = await res.json();
    if (json.success) {
      btn.textContent = 'Submitted! We will contact you soon.';
      e.target.reset();
    } else {
      alert(json.message || 'Something went wrong. Please try again.');
      btn.textContent = 'Submit Enquiry';
      btn.disabled = false;
    }
  } catch(err) {
    alert('Network error. Please check your connection and try again.');
    btn.textContent = 'Submit Enquiry';
    btn.disabled = false;
  }
});
</script>`;
}

// ─── Field Builder (used inside Create dialog) ────────────────────────────────

function FieldBuilder({
  selected,
  onChange,
}: {
  selected: FieldConfig[];
  onChange: (fields: FieldConfig[]) => void;
}) {
  const selectedKeys = selected.map((f) => f.key);

  const toggle = (avail: (typeof AVAILABLE_FIELDS)[0]) => {
    if (selectedKeys.includes(avail.key)) {
      onChange(selected.filter((f) => f.key !== avail.key));
    } else {
      onChange([
        ...selected,
        {
          key: avail.key,
          label: avail.defaultLabel,
          type: avail.type,
          required: false,
        },
      ]);
    }
  };

  const setRequired = (key: string, required: boolean) => {
    onChange(selected.map((f) => (f.key === key ? { ...f, required } : f)));
  };

  const setLabel = (key: string, label: string) => {
    onChange(selected.map((f) => (f.key === key ? { ...f, label } : f)));
  };

  return (
    <div className="space-y-3">
      {/* Fixed fields */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Always Included
        </p>
        <div className="space-y-1">
          {FIXED_FIELDS.map((f) => (
            <div
              key={f.key}
              className="flex items-center gap-3 px-3 py-2 border-2 border-black bg-zinc-50"
            >
              <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold text-black flex-1">
                {f.label}
              </span>
              <span className="text-xs text-red-600 font-semibold">
                Required
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Configurable fields */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Optional Fields — Toggle to add
        </p>
        <div className="space-y-1">
          {AVAILABLE_FIELDS.map((avail) => {
            const isOn = selectedKeys.includes(avail.key);
            const fieldConf = selected.find((f) => f.key === avail.key);
            return (
              <div
                key={avail.key}
                className={`border-2 transition-colors ${
                  isOn
                    ? "border-[#024BAB] bg-[#024BAB]/5"
                    : "border-black bg-white"
                }`}
              >
                <div className="flex items-center gap-3 px-3 py-2">
                  {/* Toggle checkbox */}
                  <button
                    type="button"
                    onClick={() => toggle(avail)}
                    className={`w-5 h-5 border-2 border-black flex items-center justify-center shrink-0 transition-colors ${
                      isOn ? "bg-[#024BAB]" : "bg-white"
                    }`}
                  >
                    {isOn && <CheckCircle className="w-3 h-3 text-white" />}
                  </button>
                  <span className="text-sm font-semibold text-black flex-1">
                    {avail.label}
                  </span>
                  {isOn && (
                    <button
                      type="button"
                      onClick={() =>
                        setRequired(avail.key, !fieldConf?.required)
                      }
                      className={`text-xs px-2 py-0.5 border font-semibold transition-colors ${
                        fieldConf?.required
                          ? "bg-red-100 border-red-400 text-red-700"
                          : "bg-zinc-100 border-zinc-300 text-zinc-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                      }`}
                    >
                      {fieldConf?.required ? "Required" : "Optional"}
                    </button>
                  )}
                </div>
                {/* Label editor when toggled on */}
                {isOn && (
                  <div className="px-3 pb-2">
                    <Input
                      value={fieldConf?.label || ""}
                      onChange={(e) => setLabel(avail.key, e.target.value)}
                      placeholder="Placeholder text shown to visitor"
                      className="text-xs border border-zinc-300 h-7"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyFields, setNewKeyFields] = useState<FieldConfig[]>([]);

  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedKeyData, setRevealedKeyData] = useState<ApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"keys" | "docs">("keys");

  const { data, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => apiKeysAPI.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => apiKeysAPI.generate(newKeyName.trim(), newKeyFields),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setShowCreate(false);
      setNewKeyName("");
      setNewKeyFields([]);
      // Build a partial ApiKey object to show the snippet immediately
      const created: ApiKey = {
        id: res.data.id,
        name: res.data.name,
        keyPrefix: res.data.keyPrefix,
        active: true,
        fields: res.data.fields || [],
        createdAt: res.data.createdAt,
        lastUsedAt: null,
      };
      setRevealedKey(res.data.key);
      setRevealedKeyData(created);
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

  const copyText = (text: string, label = "Copied!") => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(label);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetCreate = () => {
    setShowCreate(false);
    setNewKeyName("");
    setNewKeyFields([]);
  };

  const keys: ApiKey[] = (data?.data || []).filter((k: ApiKey) => k.active);

  // ── Docs tab snippet uses the first active key if any, otherwise placeholder
  const docsKey = keys[0];
  const docsSnippet = buildSnippet(docsKey?.fields || [], undefined);

  const curlSnippet = `curl -X POST ${BACKEND_URL}/api/public/leads \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY_HERE" \\
  -d '{
    "name": "Rahul Sharma",
    "phone": "9876543210",
    "company": "ABC Pvt Ltd",
    "email": "rahul@example.com",
    "requirement": "Looking for ERP software"
  }'`;

  return (
    <AppLayout title="API Keys">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-black">API Keys</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate secret keys to receive leads from your website forms
              directly into this CRM.
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

        {/* Security notice */}
        <div className="flex items-start gap-3 border-2 border-emerald-500 bg-emerald-50 p-4">
          <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-800 space-y-0.5">
            <p className="font-bold">Your data is fully protected</p>
            <p>
              The public endpoint can <strong>only create leads</strong> — it is
              impossible to read, list, or fetch any of your existing leads
              without a valid CRM login. Your API key is stored as a one-way
              hash (SHA-256) — even we cannot see the original key.
            </p>
          </div>
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

        {/* ── KEYS TAB ── */}
        {activeTab === "keys" && (
          <div className="space-y-4">
            {/* Endpoint pill */}
            <div className="border-2 border-black bg-zinc-50 p-4 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold px-2 py-0.5 bg-[#024BAB] text-white">
                POST
              </span>
              <code className="text-sm font-mono text-black flex-1 break-all">
                {BACKEND_URL}/api/public/leads
              </code>
              <button
                onClick={() =>
                  copyText(
                    `${BACKEND_URL}/api/public/leads`,
                    "Endpoint copied!",
                  )
                }
                className="p-1.5 border border-black hover:bg-[#024BAB]/10"
                title="Copy endpoint"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Loading...
              </div>
            ) : keys.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-black">
                <Key className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-semibold text-black">No API keys yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Generate your first key to start receiving leads from your
                  website.
                </p>
              </div>
            ) : (
              <div className="border-2 border-black divide-y-2 divide-black">
                {keys.map((key) => (
                  <div key={key.id}>
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0">
                        <Key className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-black text-sm">
                          {key.name}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">
                          {key.keyPrefix}••••••••••••••••••••••••••••••••••••••
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            Created{" "}
                            {new Date(key.createdAt).toLocaleDateString(
                              "en-IN",
                            )}
                          </span>
                          {key.lastUsedAt && (
                            <span className="text-xs text-muted-foreground">
                              Last used{" "}
                              {new Date(key.lastUsedAt).toLocaleDateString(
                                "en-IN",
                              )}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                            <CheckCircle className="w-3 h-3" />
                            Active
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {(key.fields?.length || 0) + 2} fields configured
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() =>
                            setExpandedKey(
                              expandedKey === key.id ? null : key.id,
                            )
                          }
                          className="p-1.5 border border-black hover:bg-[#024BAB]/10"
                          title="View fields & snippet"
                        >
                          {expandedKey === key.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRevokeTarget(key)}
                          className="text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 gap-1.5 h-8"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Revoke
                        </Button>
                      </div>
                    </div>

                    {/* Expanded: fields + snippet */}
                    {expandedKey === key.id && (
                      <div className="border-t-2 border-black bg-zinc-50 p-4 space-y-4">
                        {/* Field list */}
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                            Form Fields
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              {
                                key: "name",
                                label: "Full Name",
                                required: true,
                              },
                              {
                                key: "phone",
                                label: "Phone Number",
                                required: true,
                              },
                              ...(key.fields || []),
                            ].map((f) => (
                              <span
                                key={f.key}
                                className={`text-xs px-2 py-1 border font-semibold ${
                                  f.required
                                    ? "bg-red-50 border-red-400 text-red-700"
                                    : "bg-white border-zinc-300 text-zinc-700"
                                }`}
                              >
                                {f.label}
                                {f.required ? " *" : " (optional)"}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* HTML snippet for this specific key */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              HTML Snippet for This Key
                            </p>
                            <button
                              onClick={() => {
                                copyText(
                                  buildSnippet(key.fields || []),
                                  "Snippet copied!",
                                );
                              }}
                              className="flex items-center gap-1.5 text-xs px-3 py-1 border-2 border-black bg-white hover:bg-[#024BAB]/10 font-semibold"
                            >
                              <Copy className="w-3 h-3" />
                              Copy Snippet
                            </button>
                          </div>
                          <pre className="bg-zinc-900 text-zinc-100 text-xs p-4 border-2 border-black overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                            {buildSnippet(key.fields || [])}
                          </pre>
                          <p className="text-xs text-muted-foreground mt-2">
                            Replace{" "}
                            <code className="bg-zinc-200 px-1">
                              YOUR_API_KEY_HERE
                            </code>{" "}
                            with your actual secret key before pasting on your
                            website.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DOCS TAB ── */}
        {activeTab === "docs" && (
          <div className="space-y-6">
            <div className="border-2 border-black p-5 space-y-3">
              <h2 className="font-bold text-black">How it works</h2>
              <ol className="space-y-2 text-sm text-black list-decimal list-inside">
                <li>
                  Generate an API key — choose which fields your form should
                  collect and mark each as required or optional.
                </li>
                <li>
                  Copy the secret key shown on screen. It is shown{" "}
                  <strong>only once</strong> and cannot be recovered.
                </li>
                <li>
                  Paste the generated HTML snippet on your website and replace{" "}
                  <code className="bg-zinc-100 px-1">YOUR_API_KEY_HERE</code>.
                </li>
                <li>
                  When a visitor submits the form, a lead appears in your CRM
                  automatically with source <strong>Website</strong>.
                </li>
              </ol>
            </div>

            <div className="border-2 border-black p-5 space-y-3">
              <h2 className="font-bold text-black flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                Security Model
              </h2>
              <ul className="space-y-1.5 text-sm text-black list-disc list-inside">
                <li>
                  The public endpoint only accepts <strong>POST</strong> — GET,
                  PUT, DELETE are blocked (405).
                </li>
                <li>
                  Without a valid{" "}
                  <code className="bg-zinc-100 px-1">X-API-Key</code> header,
                  the request is rejected with <strong>401</strong>.
                </li>
                <li>
                  Your key is stored as a <strong>SHA-256 hash</strong> — the
                  original can never be recovered, even from the database.
                </li>
                <li>
                  All lead-reading endpoints (
                  <code className="bg-zinc-100 px-1">GET /api/leads</code>)
                  require a CRM login (JWT Bearer token) — inaccessible from
                  outside.
                </li>
                <li>
                  Rate limited to <strong>60 submissions per 15 minutes</strong>{" "}
                  per IP to prevent spam.
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-black uppercase tracking-wider">
                  Example HTML Snippet
                </p>
                <button
                  onClick={() => {
                    copyText(docsSnippet, "Snippet copied!");
                  }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 border-2 border-black bg-white hover:bg-[#024BAB]/10 font-semibold"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
              <pre className="bg-zinc-900 text-zinc-100 text-xs p-4 border-2 border-black overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                {docsSnippet}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-black uppercase tracking-wider">
                  cURL Example
                </p>
                <button
                  onClick={() => {
                    copyText(curlSnippet, "Copied!");
                  }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 border-2 border-black bg-white hover:bg-[#024BAB]/10 font-semibold"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
              <pre className="bg-zinc-900 text-zinc-100 text-xs p-4 border-2 border-black overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                {curlSnippet}
              </pre>
            </div>

            <div className="border-2 border-black p-5 space-y-3">
              <h2 className="font-bold text-black">Response Format</h2>
              <pre className="bg-zinc-900 text-zinc-100 text-xs p-4 border-2 border-black font-mono">
                {`// Success (201)
{ "success": true, "message": "Your enquiry has been submitted successfully.", "data": { "id": "..." } }

// Validation error (400)
{ "success": false, "message": "'Phone Number' is required" }

// Invalid key (401)
{ "success": false, "message": "Invalid or revoked API key" }

// Rate limited (429)
{ "success": false, "message": "Too many requests. Please try again later." }`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Key Dialog ── */}
      <Dialog open={showCreate} onOpenChange={resetCreate}>
        <DialogContent className="border-2 border-black max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-black">
                Key Name
              </label>
              <Input
                placeholder="e.g. Website Form, Landing Page, Contact Us"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="border-2 border-black"
              />
              <p className="text-xs text-muted-foreground">
                A label to remember where this key is used.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-black">
                Form Fields
              </label>
              <p className="text-xs text-muted-foreground">
                Choose what information to collect from visitors. Toggle a field
                to add it, then mark it required or optional.
              </p>
              <FieldBuilder
                selected={newKeyFields}
                onChange={setNewKeyFields}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={resetCreate}
              className="border-2 border-black"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newKeyName.trim() || createMutation.isPending}
              className="bg-[#024BAB] text-white border-2 border-black hover:bg-[#013a87]"
            >
              {createMutation.isPending ? "Generating..." : "Generate Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reveal Key Dialog (shown ONCE after creation) ── */}
      <Dialog
        open={!!revealedKey}
        onOpenChange={() => {
          setRevealedKey(null);
          setRevealedKeyData(null);
        }}
      >
        <DialogContent className="border-2 border-black max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Your New API Key — {revealedKeyData?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Warning */}
            <div className="bg-amber-50 border-2 border-amber-400 p-3 text-sm font-semibold text-amber-800">
              Copy this key now. It will <strong>NOT be shown again</strong> —
              we only store a hash.
            </div>

            {/* Key display */}
            <div className="border-2 border-black p-3 bg-zinc-50 flex items-center gap-2">
              <code className="text-xs font-mono flex-1 break-all">
                {revealedKey}
              </code>
              <button
                onClick={() => copyText(revealedKey!, "Secret key copied!")}
                className="p-1.5 border border-black hover:bg-[#024BAB]/10 shrink-0"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Ready-to-use snippet with the key baked in */}
            {revealedKeyData && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Ready-to-use HTML Snippet
                  </p>
                  <button
                    onClick={() =>
                      copyText(
                        buildSnippet(revealedKeyData.fields, revealedKey!),
                        "Snippet copied!",
                      )
                    }
                    className="flex items-center gap-1.5 text-xs px-3 py-1 border-2 border-black bg-white hover:bg-[#024BAB]/10 font-semibold"
                  >
                    <Copy className="w-3 h-3" />
                    Copy Snippet
                  </button>
                </div>
                <pre className="bg-zinc-900 text-zinc-100 text-xs p-4 border-2 border-black overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap max-h-60">
                  {buildSnippet(revealedKeyData.fields, revealedKey!)}
                </pre>
                <p className="text-xs text-muted-foreground">
                  The key is already embedded in the snippet above. Paste it
                  directly on your website.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setRevealedKey(null);
                setRevealedKeyData(null);
              }}
              className="bg-[#024BAB] text-white border-2 border-black hover:bg-[#013a87]"
            >
              I've saved the key & snippet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke Confirm ── */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={() => setRevokeTarget(null)}
      >
        <AlertDialogContent className="border-2 border-black">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke "{revokeTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Any website using this key will immediately stop submitting leads.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-2 border-black">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                revokeTarget && revokeMutation.mutate(revokeTarget.id)
              }
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
