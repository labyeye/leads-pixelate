import { describe, it, expect } from "vitest";
import {
  TEMPLATE_LIBRARY,
  libraryToForm,
  mappingFromNotes,
} from "@/config/whatsappTemplateLibrary";

const vars = (s: string) =>
  [
    ...new Set(
      (s.match(/\{\{(\d+)\}\}/g) || []).map((m) => Number(m.slice(2, -2))),
    ),
  ].sort((a, b) => a - b);

describe("WhatsApp template library follows Meta's template rules", () => {
  it("has unique ids", () => {
    const ids = TEMPLATE_LIBRARY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const t of TEMPLATE_LIBRARY) {
    for (const lang of ["en", "hi"] as const) {
      const f = libraryToForm(t, lang);
      const body = f.bodyText;

      it(`${t.id} (${lang}) is valid`, () => {
        expect(f.name).toMatch(/^[a-z0-9_]{1,512}$/);
        expect(body.length).toBeGreaterThan(0);
        expect(body.length).toBeLessThanOrEqual(1024);
        // Meta: body may not start or end with a variable
        expect(body.trim().startsWith("{{")).toBe(false);
        expect(body.trim().endsWith("}}")).toBe(false);
        // variables are 1..n with no gaps, and each has a sample + a meaning + a mapping
        const v = vars(body);
        expect(v).toEqual(v.map((_, i) => i + 1));
        expect(t.samples.length).toBe(v.length);
        expect(t.vars.length).toBe(v.length);
        expect(t.map.length).toBe(v.length);
        t.samples.forEach((s) => expect(s.trim()).not.toBe(""));
        // no variables in header / footer; length caps
        expect(vars(f.headerText || "")).toEqual([]);
        expect((f.headerText || "").length).toBeLessThanOrEqual(60);
        expect(f.footerText.length).toBeLessThanOrEqual(60);
        expect(vars(f.footerText)).toEqual([]);
        // header type consistency
        if (f.headerType === "TEXT") expect(f.headerText).toBeTruthy();
        if (f.headerType !== "TEXT") expect(f.headerText).toBe("");
      });

      it(`${t.id} (${lang}) hint maps back to the same variables`, () => {
        const m = mappingFromNotes(f.notes, vars(body).length);
        expect(m.map((x) => x.position)).toEqual(vars(body));
        expect(m.map((x) => x.fieldKey)).toEqual(t.map);
      });
    }
  }
});

describe("mappingFromNotes", () => {
  it("falls back to name/company/custom when there is no hint", () => {
    expect(mappingFromNotes("", 3).map((x) => x.fieldKey)).toEqual([
      "name",
      "company",
      "custom",
    ]);
  });
});
