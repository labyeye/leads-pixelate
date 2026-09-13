import { useEffect, useRef, useState } from "react";

const COUNTRIES = [
  { code: "91", flag: "🇮🇳", name: "India" },
  { code: "1", flag: "🇺🇸", name: "USA/Canada" },
  { code: "44", flag: "🇬🇧", name: "UK" },
  { code: "971", flag: "🇦🇪", name: "UAE" },
  { code: "61", flag: "🇦🇺", name: "Australia" },
  { code: "65", flag: "🇸🇬", name: "Singapore" },
  { code: "60", flag: "🇲🇾", name: "Malaysia" },
  { code: "966", flag: "🇸🇦", name: "Saudi Arabia" },
];

const DEFAULT_COUNTRY = "91";

// Bare <=10 digit values are today's format everywhere (India, no prefix) —
// treat those as India for backward compatibility. Anything longer is
// assumed to already carry one of the dial codes above.
function splitPhone(value: string) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length <= 10) return { country: DEFAULT_COUNTRY, local: digits };
  const match = COUNTRIES.find((c) => digits.startsWith(c.code));
  if (match) return { country: match.code, local: digits.slice(match.code.length) };
  return { country: DEFAULT_COUNTRY, local: digits };
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
    onChange(nextCountry === DEFAULT_COUNTRY ? nextLocal : nextCountry + nextLocal);
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-bold text-black uppercase tracking-wider">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="flex items-stretch border-2 border-black">
        <select
          value={country}
          disabled={readOnly}
          onChange={(e) => update(e.target.value, local)}
          className="border-r-2 border-black px-2 text-sm font-bold bg-white shrink-0 focus:outline-none disabled:bg-muted"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} +{c.code}
            </option>
          ))}
        </select>
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
    </div>
  );
}
