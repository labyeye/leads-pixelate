// @vitest-environment node
import { describe, it, expect } from "vitest";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { InvoicePDFDocument } from "@/components/pdf/InvoicePDFDocument";
import { defaultTemplate, fillVars, newBlock, newFloat, normalizeTemplate, PRESETS } from "@/lib/invoiceTemplate";
import { tradeDocToInvoice } from "@/lib/tradeDocPDF";

describe("template helpers", () => {
  it("falls back to the classic layout and fills gaps in stored templates", () => {
    expect(normalizeTemplate(null).blocks.map((b) => b.type)).toEqual(defaultTemplate().blocks.map((b) => b.type));
    const t = normalizeTemplate({ theme: { primary: "nope", scale: 5 }, blocks: [{ type: "note", props: { color: "red" } }, { type: "bogus" }], floats: [{ kind: "text", color: "x" }] });
    expect(t.theme.primary).toBe("#024BAB");
    expect(t.theme.scale).toBe(1.3);
    expect(t.blocks).toHaveLength(1);
    expect(t.blocks[0].props.color).toBe(""); // half-typed colour -> theme default
    expect(t.blocks[0].props.size).toBe(7.5); // default filled in
    expect(t.floats[0].color).toBe("#111111");
  });

  it("replaces {{variables}} and blanks unknown ones", () => {
    expect(fillVars("Thanks {{ client.name }} for {{invoice.number}}{{nope}}", { "client.name": "Acme", "invoice.number": "INV-1" })).toBe("Thanks Acme for INV-1");
  });
});

describe("PDF rendering with a template", () => {
  const company = { name: "Acme Ltd", addressLines: ["1 Main St", "Pune"], gst: "27AAAAA0000A1Z5", state: "Maharashtra", bank: { name: "HDFC", accountNo: "123456789" } };
  const invoice = tradeDocToInvoice("invoice", { number: "INV-1", date: "2026-09-01", partyName: "X", total: 236, taxPercent: 18, items: [{ name: "Widget", quantity: 2, rate: 100 }] });
  const PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const render = async (template: any) => {
    const buf = await pdf(<InvoicePDFDocument invoice={invoice} client={{ name: "Client", state: "Gujarat" }} company={company} template={template} />).toBuffer();
    const chunks: Buffer[] = [];
    for await (const c of buf as any) chunks.push(Buffer.from(c));
    return Buffer.concat(chunks);
  };

  it("renders the classic layout with no template", async () => {
    expect((await render(undefined)).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders every preset, every block type, hidden blocks and floats", async () => {
    for (const p of Object.values(PRESETS)) expect((await render(p.build())).length).toBeGreaterThan(1000);

    const t = defaultTemplate();
    for (const type of ["note", "image", "spacer", "divider", "title", "header", "parties", "items", "words", "summary", "taxSummary", "footer"] as const) t.blocks.push(newBlock(type, type === "image" ? { src: PX } : {}));
    t.blocks[0].visible = false;
    t.theme = { ...t.theme, font: "Times", borders: "none", scale: 1.2 };
    t.blocks.find((b) => b.type === "items")!.props = { ...t.blocks.find((b) => b.type === "items")!.props, qty: true, accentHeader: true, sno: false };
    t.floats = [newFloat("image", { src: PX, back: true, opacity: 0.2 }), newFloat("image", { src: PX, allPages: true }), newFloat("text", { text: "PAID - {{client.name}}", bold: true, color: "#ff0000" })];
    expect((await render(t)).subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("quotation", () => {
  const q = { number: "SKF-0007", date: "2026-09-01", companyName: "Buyer Co", clientName: "Ravi", address: "Pune", mobile: "9999999999", gst: "24BBBBB1111B1Z1", discount: 500, services: [{ name: "Logo design", hsnCode: "998314", price: 5000, quantity: 2 }] };

  it("maps a quotation onto the shared invoice shape (unknown / different state = IGST)", async () => {
    const { quotationToInvoice } = await import("@/lib/quotationPdf");
    const inv = quotationToInvoice(q, "27AAAAA0000A1Z5");
    expect(inv).toMatchObject({ invoiceNo: "SKF-0007", discount: 500, taxPercent: 18, paidAmount: 0, interState: true });
    expect(inv.items).toEqual([{ description: "Logo design", hsnCode: "998314", quantity: 2, price: 5000 }]);
    expect(quotationToInvoice(q, "24AAAAA0000A1Z5").interState).toBe(false); // same state: CGST + SGST
    expect(quotationToInvoice(q, undefined).interState).toBe(true);
  });

  it("uses quotation wording by default and the tenant's design once saved", async () => {
    const { templateFor } = await import("@/lib/invoiceTemplate");
    const t = templateFor("quotation", null, "Thanks for choosing us");
    expect(JSON.stringify(t)).toContain("Thanks for choosing us");
    expect(JSON.stringify(t)).toContain("this quotation shows");
    expect(JSON.stringify(templateFor("invoice", null))).toContain("computer-generated invoice");
    const saved = defaultTemplate();
    saved.theme.primary = "#ff0000";
    expect(templateFor("quotation", saved).theme.primary).toBe("#ff0000");
  });
});
