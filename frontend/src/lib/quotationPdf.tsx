import { pdf } from "@react-pdf/renderer";
import { InvoicePDFDocument } from "@/components/pdf/InvoicePDFDocument";
import { resolveLogo, settingsToCompany } from "@/lib/invoicePdf";
import { templateFor } from "@/lib/invoiceTemplate";

// Quotations print on the same template-driven document as invoices, with their own saved design
// (Settings > Quotation Designer). The issuer and logo come from Settings, the buyer from the quotation.

export const QUOTATION_LABELS = { number: "Quotation No.", date: "Quotation Date", due: "Valid Till" };

export function quotationToInvoice(q: any, sellerGst?: string) {
  const buyer = String(q.gst || "").slice(0, 2);
  const seller = String(sellerGst || "").slice(0, 2);
  return {
    invoiceNo: q.number,
    createdAt: q.date,
    dueDate: q.dueDate || q.date,
    items: (q.services || []).map((s: any) => ({ description: s.name, hsnCode: s.hsnCode || undefined, quantity: Number(s.quantity), price: Number(s.price) })),
    discount: Number(q.discount || 0),
    taxPercent: q.taxPercent ?? 18,
    paidAmount: Number(q.amountPaid || 0),
    interState: buyer && seller ? buyer !== seller : true, // unknown state = IGST, as before
  };
}

export async function quotationPdfBlob(q: any, settings: any): Promise<Blob> {
  const company = settingsToCompany(settings);
  return pdf(
    <InvoicePDFDocument
      invoice={quotationToInvoice(q, company.gst)}
      client={{ name: q.companyName || q.clientName, address: q.address, phone: q.mobile, gst: q.gst }}
      company={company}
      logo={await resolveLogo(settings?.logoUrl)}
      title={q.docTitle || settings?.quotationTitle || "PROFORMA INVOICE"}
      labels={QUOTATION_LABELS}
      template={templateFor("quotation", settings?.quotationTemplate, settings?.quotationFooter)}
    />,
  ).toBlob();
}

export async function downloadQuotationPDF(q: any, settings: any) {
  const url = URL.createObjectURL(await quotationPdfBlob(q, settings));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${q.number || "quotation"}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
