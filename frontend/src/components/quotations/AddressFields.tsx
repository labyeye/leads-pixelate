import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AddressValue {
  addressLine: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export const blankAddress: AddressValue = { addressLine: "", city: "", state: "", zip: "", country: "India" };

// The single-line form stored in `address`, which PDFs and older screens still read.
export const joinAddress = (a: AddressValue) =>
  [a.addressLine, a.city, [a.state, a.zip].filter(Boolean).join(" "), a.country].map((x) => x.trim()).filter(Boolean).join(", ");

const IN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

const box = "border-2 w-full px-3 py-2 text-sm bg-white";
const lbl = "block text-[10px] font-black uppercase tracking-widest text-black";

interface Props {
  value: AddressValue;
  onChange: (patch: Partial<AddressValue>) => void;
}

// Free public APIs: postalpincode.in (PIN -> district/state/areas) and countriesnow.space (state -> cities).
// Both are only suggestions; every field stays editable and works offline as plain text.
export function AddressFields({ value, onChange }: Props) {
  const isIndia = value.country.trim().toLowerCase() === "india";
  const [cities, setCities] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [pinNote, setPinNote] = useState("");
  const pinToken = useRef(0);

  // Typing/pasting a 6-digit PIN fills city, state and country.
  const onZip = async (raw: string) => {
    const zip = isIndia ? raw.replace(/\D/g, "").slice(0, 6) : raw.slice(0, 12);
    onChange({ zip });
    setPinNote("");
    if (!isIndia || zip.length !== 6) return;
    const token = ++pinToken.current;
    setLookingUp(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${zip}`);
      const data = (await res.json())[0];
      if (token !== pinToken.current) return;
      const offices: any[] = data?.Status === "Success" ? data.PostOffice || [] : [];
      if (!offices.length) return setPinNote("PIN code not found — fill city and state manually.");
      const state = IN_STATES.find((s) => s.toLowerCase() === String(offices[0].State).toLowerCase()) || offices[0].State;
      setAreas([...new Set<string>(offices.map((o) => o.Name))]);
      onChange({ zip, city: offices[0].District || offices[0].Block || "", state, country: "India" });
    } catch {
      if (token === pinToken.current) setPinNote("Could not look up the PIN code — fill city and state manually.");
    } finally {
      if (token === pinToken.current) setLookingUp(false);
    }
  };

  // City suggestions for the chosen state.
  useEffect(() => {
    setCities([]);
    if (!isIndia || !value.state) return;
    let stale = false;
    fetch(`https://countriesnow.space/api/v0.1/countries/state/cities/q?country=India&state=${encodeURIComponent(value.state)}`)
      .then((r) => r.json())
      .then((d) => !stale && Array.isArray(d?.data) && setCities(d.data))
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [isIndia, value.state]);

  const suggestions = [...new Set([value.city, ...areas, ...cities].filter(Boolean))].slice(0, 400);

  return (
    // Fragment: the four fields sit directly in the parent 4-column grid, one row like GST / Mobile / Aadhar / PAN.
    <>
      <div className="col-span-1 sm:col-span-4 space-y-1">
        <label htmlFor="addressLine" className={lbl}>Address line (optional)</label>
        <textarea
          id="addressLine"
          rows={2}
          value={value.addressLine}
          onChange={(e) => onChange({ addressLine: e.target.value })}
          placeholder="House / building, street, area"
          className={cn(box, "resize-none")}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="zip" className={lbl}>
          {isIndia ? "PIN code" : "ZIP / postal code"}
          {lookingUp && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />}
        </label>
        <input
          id="zip"
          value={value.zip}
          onChange={(e) => onZip(e.target.value)}
          inputMode={isIndia ? "numeric" : "text"}
          placeholder={isIndia ? "e.g. 411001" : "Postal code"}
          className={box}
        />
        {pinNote && <p className="text-[10px] text-red-600">{pinNote}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="country" className={lbl}>Country</label>
        <input id="country" value={value.country} onChange={(e) => onChange({ country: e.target.value })} className={box} />
      </div>

      <div className="space-y-1">
        <label htmlFor="state" className={lbl}>State</label>
        {isIndia ? (
          <select
            id="state"
            value={value.state}
            onChange={(e) => onChange({ state: e.target.value, city: "" })}
            className={box}
          >
            <option value="">Select state</option>
            {value.state && !IN_STATES.includes(value.state) && <option value={value.state}>{value.state}</option>}
            {IN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : (
          <input id="state" value={value.state} onChange={(e) => onChange({ state: e.target.value })} className={box} />
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="city" className={lbl}>City</label>
        <input
          id="city"
          list="addr-cities"
          value={value.city}
          onChange={(e) => onChange({ city: e.target.value })}
          placeholder={isIndia && value.state ? "Pick or type city" : "City"}
          className={box}
        />
        <datalist id="addr-cities">
          {suggestions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
    </>
  );
}
