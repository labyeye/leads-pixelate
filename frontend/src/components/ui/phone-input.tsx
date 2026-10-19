import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const COUNTRIES = [
  { code: "91", iso: "in", flag: "🇮🇳", name: "India" },
  { code: "1", iso: "us", flag: "🇺🇸", name: "USA/Canada" },
  { code: "44", iso: "gb", flag: "🇬🇧", name: "UK" },
  { code: "971", iso: "ae", flag: "🇦🇪", name: "UAE" },
  { code: "61", iso: "au", flag: "🇦🇺", name: "Australia" },
  { code: "65", iso: "sg", flag: "🇸🇬", name: "Singapore" },
  { code: "60", iso: "my", flag: "🇲🇾", name: "Malaysia" },
  { code: "966", iso: "sa", flag: "🇸🇦", name: "Saudi Arabia" },
];

const DEFAULT_COUNTRY = "91";

// Bare <=10 digit values are today's format everywhere (India, no prefix) —
// treat those as India for backward compatibility. Anything longer is
// assumed to already carry one of the dial codes above.
function splitPhone(value: string) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length <= 10) return { country: DEFAULT_COUNTRY, local: digits };
  const match = COUNTRIES.find((c) => digits.startsWith(c.code));
  if (match)
    return { country: match.code, local: digits.slice(match.code.length) };
  return { country: DEFAULT_COUNTRY, local: digits };
}

// Emoji flags do not render on Windows (they show as "IN"), so use real flag images.
function Flag({ iso, name }: { iso: string; name: string }) {
  return (
    <img
      src={`https://flagcdn.com/w40/${iso}.png`}
      alt={name}
      width={22}
      height={16}
      loading="lazy"
      className="h-4 w-[22px] shrink-0 border border-black/30 object-cover"
    />
  );
}

interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
}

// Country-code select + local number input. Emits a bare 10-digit string for
// India (the default, and what every existing consumer already expects) or
// "<dialcode><localnumber>" for anything else — no schema/backend changes
// needed since that's exactly the format WhatsApp-send phone formatting
// already treats as "already has a country code".
export function PhoneInput({
  label,
  value,
  onChange,
  placeholder = "10-digit number",
  readOnly = false,
  required = false,
}: PhoneInputProps) {
  const [country, setCountry] = useState(() => splitPhone(value).country);
  const [local, setLocal] = useState(() => splitPhone(value).local);
  const syncedRef = useRef(!!value);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = COUNTRIES.find((c) => c.code === country) ?? COUNTRIES[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // Settings/user data often loads asynchronously after mount — pick up the
  // real value the first time it arrives, but don't fight the user's typing
  // on every subsequent parent re-render.
  useEffect(() => {
    if (!syncedRef.current && value) {
      const parsed = splitPhone(value);
      setCountry(parsed.country);
      setLocal(parsed.local);
      syncedRef.current = true;
    }
  }, [value]);

  const update = (nextCountry: string, nextLocalRaw: string) => {
    const maxLen = nextCountry === DEFAULT_COUNTRY ? 10 : 12;
    const nextLocal = nextLocalRaw.replace(/\D/g, "").slice(0, maxLen);
    setCountry(nextCountry);
    setLocal(nextLocal);
    onChange(
      nextCountry === DEFAULT_COUNTRY ? nextLocal : nextCountry + nextLocal,
    );
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-bold text-black uppercase tracking-wider">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div ref={rootRef} className="relative">
        <div className="flex items-stretch border-2 border-black bg-white">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label="Country code"
            className="no-nb flex shrink-0 items-center gap-1.5 border-r-2 border-black px-2.5 text-sm font-bold hover:bg-muted disabled:bg-muted"
          >
            <Flag iso={current.iso} name={current.name} />+{current.code}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <input
            type="tel"
            inputMode="numeric"
            value={local}
            readOnly={readOnly}
            placeholder={placeholder}
            onChange={(e) => update(country, e.target.value)}
            className="flex-1 px-3 py-2 text-sm min-w-0 focus:outline-none disabled:bg-muted"
          />
        </div>
        {open && (
          <ul
            role="listbox"
            className="absolute left-0 top-full z-50 mt-1.5 max-h-60 w-64 overflow-auto border-2 border-black bg-white shadow-[3px_3px_0px_#0a0a0a]"
          >
            {COUNTRIES.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.code === country}
                  onClick={() => {
                    update(c.code, local);
                    setOpen(false);
                  }}
                  className={`no-nb flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-[#024BAB]/10 ${c.code === country ? "bg-[#024BAB]/10 font-bold" : ""}`}
                >
                  <Flag iso={c.iso} name={c.name} />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-black/50">+{c.code}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
