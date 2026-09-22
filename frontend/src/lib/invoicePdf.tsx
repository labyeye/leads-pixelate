import { pdf } from "@react-pdf/renderer";
import { InvoicePDFDocument, type InvoiceCompany } from "@/components/pdf/InvoicePDFDocument";
import defaultLogo from "@/assets/images/NestLeads_Logo_Name.png";

// react-pdf only reads PNG/JPEG, so any logo (webp, svg, a URL...) goes through a canvas first.
// null when it can't be loaded (e.g. a cross-origin URL without CORS); callers fall back.
export async function pngDataUrl(src: string): Promise<string | undefined> {
  return (await logoToPng(src)) || undefined;
}

async function logoToPng(src: string): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("logo"));
      img.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 300;
    canvas.height = img.naturalHeight || 100;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

// The tenant's own logo when they uploaded one, else the bundled NestLeads logo.
export async function resolveLogo(custom?: string): Promise<string | undefined> {
  const own = custom?.trim() ? await logoToPng(custom.trim()) : null;
  return own || (await pngDataUrl(defaultLogo));
}

// Company block of the PDF from the tenant's Settings (Settings > Company).
export function settingsToCompany(s: any): InvoiceCompany {
  const hasBank = !!(s?.bankAccountNumber || s?.bankName);
  return {
    name: s?.companyName || "Your Company",
    addressLines: String(s?.companyAddress || "").split("\n").map((l) => l.trim()).filter(Boolean),
    email: s?.companyEmail,
    phone: s?.companyPhone,
    website: s?.companyWebsite,
    gst: s?.companyGST,
    pan: s?.companyPAN,
    state: s?.companyState,
    stateCode: s?.companyStateCode,
    bank: hasBank
      ? { name: s.bankName, accountNo: s.bankAccountNumber, accountName: s.bankAccountName || s.companyName, ifsc: s.bankIFSC, branch: s.bankBranch, type: s.bankAccountType }
      : undefined,
    terms: s?.quotationTerms,
  };
}

// Intra-state (CGST + SGST) or inter-state (IGST) from the first two digits of the two GSTINs.
export const isInterState = (sellerGst?: string, buyerGst?: string) =>
  sellerGst && buyerGst && sellerGst.length >= 2 && buyerGst.length >= 2 ? sellerGst.slice(0, 2) !== buyerGst.slice(0, 2) : undefined;

export async function saveInvoicePDF(fileName: string, props: React.ComponentProps<typeof InvoicePDFDocument>) {
  const blob = await pdf(<InvoicePDFDocument {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
