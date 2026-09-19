import React, { useState, useEffect } from "react";
import { aiCallingAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import {
  PhoneCall,
  Bot,
  Key,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Clock,
  HelpCircle,
  Sparkles,
  Sliders,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface Question {
  id: string;
  questionText: string;
  fieldKey: string;
  required: boolean;
}

interface AICallSettings {
  enabled: boolean;
  elevenLabsApiKey: string;
  agentId: string;
  envApiKeySet?: boolean;
  envAgentIdSet?: boolean;
  phoneProvider: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  callDelayMinutes: number;
  callingHoursStart: string;
  callingHoursEnd: string;
  agentGreeting: string;
  agentPersona: string;
  questions: Question[];
  autoStatusMapping: {
    qualifiedStatus: string;
    unqualifiedStatus: string;
    noAnswerStatus: string;
  };
}

export default function AICallingSettingsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [settings, setSettings] = useState<AICallSettings>({
    enabled: false,
    elevenLabsApiKey: "",
    agentId: "",
    phoneProvider: "elevenlabs",
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioPhoneNumber: "",
    callDelayMinutes: 1,
    callingHoursStart: "09:00",
    callingHoursEnd: "19:00",
    agentGreeting: "Hello {lead_name}, I am calling from {company_name}! I noticed your inquiry and wanted to briefly verify your requirements.",
    agentPersona: "You are a warm, professional, polite sales executive qualification assistant.",
    questions: [
      { id: "q1", questionText: "What product or service are you primarily looking for?", fieldKey: "interestedProducts", required: true },
      { id: "q2", questionText: "What is your approximate budget for this requirement?", fieldKey: "budget", required: true },
      { id: "q3", questionText: "How soon are you planning to make a purchase?", fieldKey: "requirement", required: true },
    ],
    autoStatusMapping: {
      qualifiedStatus: "QUALIFIED",
      unqualifiedStatus: "LOST",
      noAnswerStatus: "ATTEMPTED CONTACT",
    },
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await aiCallingAPI.getSettings();
      if (res.success && res.data) {
        setSettings((prev) => ({
          ...prev,
          ...res.data,
          autoStatusMapping: {
            ...prev.autoStatusMapping,
            ...(res.data.autoStatusMapping || {}),
          },
        }));
      }
    } catch (err: any) {
      toast({
        title: "Error fetching AI call settings",
        description: err.message || "Failed to load settings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await aiCallingAPI.updateSettings(settings);
      if (res.success) {
        toast({
          title: "Settings Saved",
          description: "ElevenLabs AI calling settings have been updated.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Failed to save settings",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const res = await aiCallingAPI.testConnection(settings.elevenLabsApiKey, settings.agentId);
      setTestResult({
        success: true,
        message: res.message || "ElevenLabs Voice Agent connection verified!",
      });
      toast({
        title: "Connection Successful",
        description: "ElevenLabs Voice Agent API connected cleanly.",
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Connection failed. Check API key and Agent ID.",
      });
      toast({
        title: "Connection Failed",
        description: err.message || "Please check your ElevenLabs credentials.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const addQuestion = () => {
    const newId = `q_${Date.now()}`;
    setSettings((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        { id: newId, questionText: "", fieldKey: "", required: true },
      ],
    }));
  };

  const updateQuestion = (index: number, key: keyof Question, value: any) => {
    setSettings((prev) => {
      const updated = [...prev.questions];
      updated[index] = { ...updated[index], [key]: value };
      return { ...prev, questions: updated };
    });
  };

  const removeQuestion = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 font-medium">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading ElevenLabs AI Calling Settings...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white p-6 border-2 border-black shadow-[6px_6px_0px_#000]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 border border-white/20">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black font-display tracking-wide uppercase">
                ElevenLabs AI Outbound Voice Assistant
              </h2>
              <p className="text-xs text-blue-200 font-medium mt-1">
                Automatically call new leads, ask dynamic qualification questions, transcribe & analyze responses, and auto-update lead remarks.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none border-2 border-white peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
            <span className="text-xs font-bold uppercase tracking-wider">
              {settings.enabled ? "Active" : "Disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* 1. AI Voice Engine Status Card */}
      <div className="bg-emerald-50 border-2 border-emerald-600 p-4 shadow-[4px_4px_0px_#000] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 text-white rounded-full">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-emerald-950 uppercase tracking-wide">
              ElevenLabs Voice Engine Ready
            </h4>
            <p className="text-xs text-emerald-800 font-medium">
              The AI voice assistant is configured and powered by your system's master ElevenLabs API engine.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing}
          className="px-3.5 py-1.5 bg-emerald-700 text-white font-bold text-xs border-2 border-black hover:bg-emerald-800 transition-colors flex items-center gap-1.5 shrink-0"
        >
          {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
          Test Voice Engine
        </button>
      </div>

      {testResult && (
        <div className={`p-3 border-2 text-xs font-bold flex items-center gap-2 ${testResult.success ? "bg-emerald-50 border-emerald-500 text-emerald-800" : "bg-red-50 border-red-500 text-red-800"}`}>
          {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {testResult.message}
        </div>
      )}

      {/* 2. Custom Qualification Questions Builder */}
      <div className="bg-white border-2 border-black p-6 space-y-5 shadow-[4px_4px_0px_#000]">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div>
            <h3 className="text-lg font-black font-display text-black uppercase flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-600" /> Dynamic Qualification Questions
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              The ElevenLabs AI assistant will ask these questions during the call and parse the client's answers automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={addQuestion}
            className="px-3 py-1.5 bg-blue-600 text-white font-bold text-xs border-2 border-black hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Question
          </button>
        </div>

        <div className="space-y-4">
          {settings.questions.map((q, idx) => (
            <div key={q.id || idx} className="p-4 border-2 border-black bg-gray-50 flex flex-col md:flex-row gap-4 items-start md:items-center">
              <span className="w-7 h-7 shrink-0 bg-black text-white font-black text-xs flex items-center justify-center">
                {idx + 1}
              </span>
              <div className="flex-1 space-y-2 w-full">
                <input
                  type="text"
                  value={q.questionText}
                  onChange={(e) => updateQuestion(idx, "questionText", e.target.value)}
                  placeholder="Enter qualification question text (e.g. What is your estimated budget?)"
                  className="w-full px-3 py-2 border-2 border-black bg-white text-xs font-bold focus:outline-none focus:border-blue-600"
                />
                <div className="flex items-center gap-4 text-xs font-semibold text-gray-600">
                  <label className="flex items-center gap-1.5">
                    <span>Map answer to Lead field:</span>
                    <select
                      value={q.fieldKey}
                      onChange={(e) => updateQuestion(idx, "fieldKey", e.target.value)}
                      className="px-2 py-1 border-2 border-black bg-white text-xs font-bold"
                    >
                      <option value="">None (Append to remarks only)</option>
                      <option value="budget">Budget</option>
                      <option value="interestedProducts">Interested Products</option>
                      <option value="requirement">Requirement</option>
                    </select>
                  </label>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeQuestion(idx)}
                className="p-2 text-red-600 hover:bg-red-50 border-2 border-transparent hover:border-red-500 transition-colors self-end md:self-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Agent Greeting & Working Hours */}
      <div className="bg-white border-2 border-black p-6 space-y-5 shadow-[4px_4px_0px_#000]">
        <h3 className="text-lg font-black font-display text-black uppercase border-b-2 border-black pb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" /> Greeting Template & Allowed Calling Hours
        </h3>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
            Initial Agent Greeting Message
          </label>
          <textarea
            rows={3}
            value={settings.agentGreeting}
            onChange={(e) => setSettings((prev) => ({ ...prev, agentGreeting: e.target.value }))}
            className="w-full px-4 py-2.5 border-2 border-black text-xs font-medium focus:outline-none focus:border-blue-600"
          />
          <p className="text-[11px] text-gray-500 mt-1">Available dynamic placeholders: <code className="bg-gray-100 font-bold px-1">{`{lead_name}`}</code>, <code className="bg-gray-100 font-bold px-1">{`{company_name}`}</code></p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
              Call Delay (Minutes after Lead Creation)
            </label>
            <input
              type="number"
              min="0"
              max="60"
              value={settings.callDelayMinutes}
              onChange={(e) => setSettings((prev) => ({ ...prev, callDelayMinutes: parseInt(e.target.value) || 0 }))}
              className="w-full px-4 py-2.5 border-2 border-black text-sm focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
              Calling Window Start Time
            </label>
            <input
              type="time"
              value={settings.callingHoursStart}
              onChange={(e) => setSettings((prev) => ({ ...prev, callingHoursStart: e.target.value }))}
              className="w-full px-4 py-2.5 border-2 border-black text-sm focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
              Calling Window End Time
            </label>
            <input
              type="time"
              value={settings.callingHoursEnd}
              onChange={(e) => setSettings((prev) => ({ ...prev, callingHoursEnd: e.target.value }))}
              className="w-full px-4 py-2.5 border-2 border-black text-sm focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="sticky bottom-0 z-10 flex justify-end gap-4 py-3 bg-white border-t-2 border-black">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white font-black text-sm border-2 border-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#000] transition-all flex items-center gap-2"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save AI Calling Settings
        </button>
      </div>
    </div>
  );
}
