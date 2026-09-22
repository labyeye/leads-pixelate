import { describe, it, expect } from "vitest";
import { tradeDocToInvoice } from "@/lib/tradeDocPDF";
import { isInterState, settingsToCompany } from "@/lib/invoicePdf";

describe("tradeDocToInvoice", () => {
  const doc = {
    number: "PO-0003",
    date: "2026-09-21",
    dueDate: "2026-10-01",
    partyName: "Acme",
    reference: "REF-9",
    total: 236,
    discount: 50,
    taxPercent: 12,
    status: "Received",
    notes: "Pay in 7 days",
    items: [{ name: "Widget", hsnCode: "8471", quantity: 2, rate: 100 }],
  };

  it("maps a purchase order onto the shared invoice shape", () => {
    const inv = tradeDocToInvoice("purchase_order", doc, "10ABC", { gst: "27XYZ" });
    expect(inv).toMatchObject({
      invoiceNo: "PO-0003",
      poNumber: "REF-9",
      taxPercent: 12,
      discount: 50,
      paidAmount: 0,
      notes: "Pay in 7 days",
      interState: true, // different state codes (10 vs 27)
    });
    expect(inv.items).toEqual([{ description: "Widget", hsnCode: "8471", quantity: 2, price: 100, details: "Qty: 2 x Rs. 100" }]);
  });

  it("marks a paid invoice as paid in full, and falls back to no notes", () => {
    const inv = tradeDocToInvoice("invoice", { ...doc, status: "Paid", notes: "" });
    expect(inv.paidAmount).toBe(236);
    expect(inv.notes).toBeUndefined();
  });
});

describe("isInterState", () => {
  it("compares the first two digits of the two GSTINs", () => {
    expect(isInterState("10ABFFK0650E1Z2", "27AAAAA0000A1Z5")).toBe(true);
    expect(isInterState("10ABFFK0650E1Z2", "10AAAAA0000A1Z5")).toBe(false);
    expect(isInterState(undefined, "10AAAAA0000A1Z5")).toBeUndefined();
  });
});

describe("settingsToCompany", () => {
  it("only includes bank details when the tenant has set them", () => {
    expect(settingsToCompany({ companyName: "Acme", bankName: "HDFC" }).bank).toMatchObject({ name: "HDFC" });
    expect(settingsToCompany({ companyName: "Acme" }).bank).toBeUndefined();
  });

  it("splits a multi-line address", () => {
    expect(settingsToCompany({ companyAddress: "Line 1\nLine 2" }).addressLines).toEqual(["Line 1", "Line 2"]);
  });
});
