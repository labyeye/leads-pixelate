import { isInterState, resolveLogo, saveInvoicePDF, settingsToCompany } from "@/lib/invoicePdf";

// Sales orders, purchase orders and invoices print on the Pixelate Nest tax-invoice template
// (components/pdf/InvoicePDFDocument). The issuing company, with its own logo, comes from the
// tenant's Settings; the party from the client record.
const KINDS = {
  sales_order: { title: "SALES ORDER", labels: { number: "Order No.", date: "Order Date", due: "Delivery Date" } },
  purchase_order: { title: "PURCHASE ORDER", labels: { number: "PO No.", date: "PO Date", due: "Delivery Date" } },
  invoice: { title: "TAX INVOICE", labels: { number: "Invoice No.", date: "Invoice Date", due: "Due Date" } },
} as const;

export type TradeKind = keyof typeof KINDS;

export function tradeDocToInvoice(kind: TradeKind, d: any, sellerGst?: string, client?: any) {
  return {
    invoiceNo: d.number,
    createdAt: d.date,
    dueDate: d.dueDate || undefined,
    poNumber: d.reference || undefined,
    items: (d.items || []).map((i: any) => ({
      description: i.name,
      hsnCode: i.hsnCode || undefined,
      quantity: i.quantity,
      price: i.rate,
      details: `Qty: ${i.quantity} x Rs. ${Number(i.rate).toLocaleString("en-IN")}`, // the template has no quantity column
    })),
    discount: d.discount || 0,
    taxPercent: d.taxPercent ?? 18,
    paidAmount: kind === "invoice" && d.status === "Paid" ? d.total : 0,
    // Notes replace the default terms when the user wrote some.
    notes: d.notes || undefined,
    interState: isInterState(sellerGst, client?.gst),
  };
}

export async function downloadTradeDocPDF(kind: TradeKind, d: any, settings: any, client?: any) {
  const company = settingsToCompany(settings);
  const cfg = KINDS[kind];
  await saveInvoicePDF(d.number, {
    invoice: tradeDocToInvoice(kind, d, company.gst, client),
    client: {
      name: client?.company || client?.name || d.partyName,
      address: client?.address,
      phone: client?.phone,
      email: client?.email,
      gst: client?.gst,
    },
    company,
    logo: await resolveLogo(settings?.logoUrl),
    title: cfg.title,
    labels: cfg.labels,
  });
}
