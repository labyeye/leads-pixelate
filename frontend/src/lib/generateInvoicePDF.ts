import jsPDF from "jspdf";
import logo from "@/assets/images/qlogo.png";

const PRIMARY = "#1e3a8a";
const SECONDARY = "#111827";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const BG_SUBTLE = "#f9fafb";
const WHITE = "#ffffff";

const PW = 595.28;
const PH = 841.89;
const ML = 36;
const MR = 36;
const CW = PW - ML - MR;

function toRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

const setFill = (doc: jsPDF, c: string) => {
  const { r, g, b } = toRgb(c);
  doc.setFillColor(r, g, b);
};
const setDraw = (doc: jsPDF, c: string) => {
  const { r, g, b } = toRgb(c);
  doc.setDrawColor(r, g, b);
};
const setTextClr = (doc: jsPDF, c: string) => {
  const { r, g, b } = toRgb(c);
  doc.setTextColor(r, g, b);
};

function fillRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke?: string,
) {
  setFill(doc, fill);
  if (stroke) {
    setDraw(doc, stroke);
    doc.rect(x, y, w, h, "FD");
  } else doc.rect(x, y, w, h, "F");
}

function hline(doc: jsPDF, x: number, y: number, w: number, c: string) {
  setDraw(doc, c);
  doc.line(x, y, x + w, y);
}

async function loadFont(
  doc: jsPDF,
  file: string,
  name: string,
  style: string,
): Promise<boolean> {
  try {
    const res = await fetch(`/fonts/${file}`);
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    doc.addFileToVFS(file, btoa(bin));
    doc.addFont(file, name, style);
    return true;
  } catch {
    return false;
  }
}

export async function generateInvoicePDF(q: any, settings: any): Promise<void> {
  const doc = await getInvoicePDF(q, settings);
  doc.save(`${q.number || "quotation"}.pdf`);
}

export async function getInvoicePDF(q: any, settings: any): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

  const companyName = settings?.companyName || "BAGCLUES EXIM PRIVATE LIMITED";
  const companyAddress =
    settings?.companyAddress || "A-79, SECTOR 58, NOIDA(UP)-201301";
  const companyPhone = settings?.companyPhone || "76540-44444, 76540-22222";
  const companyEmail = settings?.companyEmail || "BAGCLUES@GMAIL.COM";
  const companyGST = settings?.companyGST || "09AAGCB9274N1ZW";
  const companyWebsite = settings?.companyWebsite || "WWW.SKYLYF.COM";

  const bankAccountName = settings?.bankAccountName || companyName;
  const bankAccountNumber = settings?.bankAccountNumber || "59207654044444";
  const bankName = settings?.bankName || "HDFC BANK";
  const bankIFSC = settings?.bankIFSC || "HDFC0002649";
  const bankBranch =
    settings?.bankBranch || "C-25, STELLAR IT PARK, NOIDA-201306, UP";

  const termLines =
    settings?.quotationTerms?.length > 0
      ? settings.quotationTerms
      : [
          "Delivery shall be from Noida; transportation and unloading at site shall be arranged and borne by the buyer.",
          "Delivery Schedule: Within 30 days or subject to stock availability.",
          "Payment Terms: An advance of 20% is payable at order confirmation, with the balance payable before dispatch.",
          "Installation: Free installation and training at buyer's site; conveyance charges borne by buyer.",
          "Validity: Prices valid for 30 days from issue date.",
          "Cancellation: The company reserves the right to forfeit the advance payment.",
        ];

  const quotationTitle = settings?.quotationTitle || "PROFORMA INVOICE";
  const footerText =
    settings?.quotationFooter || "Thank you for your business!";

  const regularOk = await loadFont(
    doc,
    "NotoSans-Regular.ttf",
    "NotoSans",
    "normal",
  );
  const boldOk = await loadFont(doc, "NotoSans-Bold.ttf", "NotoSans", "bold");
  const fontOk = regularOk && boldOk;

  const F = fontOk ? "NotoSans" : "helvetica";
  const setN = (sz: number) => {
    doc.setFont(F, "normal");
    doc.setFontSize(sz);
  };
  const setB = (sz: number) => {
    doc.setFont(F, "bold");
    doc.setFontSize(sz);
  };
  const setI = (sz: number) => {
    doc.setFont(F, fontOk ? "normal" : "italic");
    doc.setFontSize(sz);
  };

  const rupee = (n: number, dec = 2) =>
    (fontOk ? "₹" : "Rs.") +
    n.toLocaleString("en-IN", {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });

  const subtotal = (q.services || []).reduce(
    (a: number, s: any) => a + Number(s.price) * Number(s.quantity),
    0,
  );
  const discount = Number(q.discount || 0);
  const tax = (subtotal - discount) * 0.18;
  const total = subtotal - discount + tax;

  const borderMargin = 15;
  setDraw(doc, LINE);
  doc.setLineWidth(0.5);
  doc.rect(
    borderMargin,
    borderMargin,
    PW - borderMargin * 2,
    PH - borderMargin * 2,
    "S",
  );

  const HT = 32;
  const logoW = 45;
  const logoH = 60;

  try {
    doc.addImage(logo, "PNG", ML, HT, logoW, logoH);
  } catch (err) {
    console.error("Error adding logo to PDF:", err);
  }

  const textX = ML + logoW + 20;

  setB(13);
  setTextClr(doc, PRIMARY);
  doc.text(companyName.toUpperCase(), textX, HT + 10);

  setN(8.5);
  setTextClr(doc, MUTED);

  const headerLines = [
    companyAddress,
    `M.NO: ${companyPhone}`,
    `EMAIL: ${companyEmail}`,
  ];
  headerLines.forEach((l, i) =>
    doc.text(l.toUpperCase(), textX, HT + 24 + i * 11),
  );

  setB(8.5);
  setTextClr(doc, SECONDARY);
  doc.text(`GST NO: ${companyGST.toUpperCase()}`, textX, HT + 58);

  setB(14);
  setTextClr(doc, PRIMARY);
  doc.text(quotationTitle.toUpperCase(), PW - MR, HT + 12, { align: "right" });

  const tX = PW - MR - 165;
  const tY = HT + 35;
  const cW1 = 58;
  const cW2 = 107;
  const rH = 16;
  [
    ["DATE", new Date(q.date).toLocaleDateString("en-GB")],
    ["REF. NO.", q.number || "SKF-0001"],
  ].forEach(([lbl, val], i) => {
    const ry = tY + i * rH;
    fillRect(doc, tX, ry, cW1, rH, BG_SUBTLE, LINE);
    fillRect(doc, tX + cW1, ry, cW2, rH, WHITE, LINE);
    setB(7.5);
    setTextClr(doc, PRIMARY);
    doc.text(lbl, tX + 4, ry + 10.5);
    setN(7.5);
    setTextClr(doc, SECONDARY);
    doc.text(val, tX + cW1 + 4, ry + 10.5);
  });

  const ST = HT + 78;
  const halfW = CW / 2 - 8;
  const sectionLbl = (lbl: string, x: number, y: number, w: number) => {
    setB(8.5);
    setTextClr(doc, PRIMARY);
    doc.text(lbl, x + 6, y);
    hline(doc, x + 6, y + 4, w - 12, LINE);
  };

  let cy = ST + 40;

  const buyerRow = (label: string, value: string | undefined) => {
    const v = (value || "").trim();
    if (!v) return;
    setB(8.5);
    setTextClr(doc, MUTED);
    doc.text(label.toUpperCase(), ML + 8, cy);
    setN(8.5);
    setTextClr(doc, SECONDARY);
    const labelW = doc.getTextWidth(label.toUpperCase()) + 4;
    doc.text("- " + v, ML + 8 + labelW, cy);
    cy += 11;
  };

  if (q.companyName?.trim()) {
    setB(11);
    setTextClr(doc, SECONDARY);
    doc.text(q.companyName.toUpperCase(), ML + 8, cy);
    cy += 14;
    setN(9);
    setTextClr(doc, MUTED);
    doc.text(q.clientName || "", ML + 8, cy);
    cy += 12;
  } else {
    setB(11);
    setTextClr(doc, SECONDARY);
    doc.text((q.clientName || "").toUpperCase(), ML + 8, cy);
    cy += 14;
  }

  if ((q.address || "").trim()) {
    setN(9);
    setTextClr(doc, MUTED);
    doc
      .splitTextToSize(q.address as string, halfW - 16)
      .forEach((l: string) => {
        doc.text(l, ML + 8, cy);
        cy += 10;
      });
    cy += 4;
  }

  buyerRow("Aadhar Number", q.aadhar);
  buyerRow("PAN Number", q.pan);
  buyerRow("GST No", q.gst);
  buyerRow("Mobile No", q.mobile);

  const bankRows: [string, string][] = [
    ["BENEFICIARY", bankAccountName.toUpperCase()],
    ["A/C NO.", bankAccountNumber],
    ["BANK", bankName.toUpperCase()],
    ["IFSC", bankIFSC.toUpperCase()],
    ["BRANCH", bankBranch.toUpperCase()],
  ];

  const bkBH = bankRows.length * 15 + 10;
  const by_end_calc = ST + 6 + bkBH;

  const sectionH = Math.max(cy, by_end_calc) - ST + 20;

  setDraw(doc, LINE);
  doc.setLineWidth(0.5);
  doc.rect(ML, ST, halfW, sectionH, "S");
  sectionLbl("CONSIGNEE / BUYER", ML, ST + 10, halfW);

  const bkX = ML + halfW + 16;
  const bkW = halfW;
  doc.rect(bkX, ST, bkW, sectionH, "S");
  sectionLbl("SUPPLIER BANK DETAILS", bkX, ST + 10, bkW);

  let by = ST + 40;
  bankRows.forEach(([lbl, val]) => {
    setB(7.5);
    setTextClr(doc, MUTED);
    doc.text(lbl, bkX + 8, by);
    setB(8);
    setTextClr(doc, SECONDARY);
    const w2 = doc.splitTextToSize(val, bkW - 85);
    doc.text(w2[0], bkX + bkW - 8, by, { align: "right" });
    if (w2[1]) doc.text(w2[1], bkX + bkW - 8, by + 8, { align: "right" });
    hline(doc, bkX + 8, by + 4, bkW - 16, BG_SUBTLE);
    by += 15;
  });

  const finalSectionY = ST - 12 + sectionH;

  const tableTop = finalSectionY + 20;

  const C_D = CW * 0.5;
  const C_Q = CW * 0.1;
  const C_P = CW * 0.2;
  const C_T = CW * 0.2;
  const colX = [ML, ML + C_D, ML + C_D + C_Q, ML + C_D + C_Q + C_P];
  const colW = [C_D, C_Q, C_P, C_T];
  const HDR_H = 20;

  fillRect(doc, ML, tableTop, CW, HDR_H, BG_SUBTLE, LINE);
  setB(8);
  setTextClr(doc, PRIMARY);
  (
    [
      ["DESCRIPTION", "left"],
      ["QTY", "center"],
      ["UNIT PRICE", "right"],
      ["TOTAL AMOUNT", "right"],
    ] as [string, "left" | "center" | "right"][]
  ).forEach(([h, al], i) => {
    const cx =
      al === "center"
        ? colX[i] + colW[i] / 2
        : al === "right"
          ? colX[i] + colW[i] - 6
          : colX[i] + 6;
    doc.text(h, cx, tableTop + 13, { align: al });
  });

  const ROW_H = 22;
  const SPEC_H = 12;
  let rowY = tableTop + HDR_H;

  (q.services || []).forEach((s: any, i: number) => {
    const bg = i % 2 === 0 ? WHITE : "#f8fafc";
    const lineTotal = Number(s.price) * Number(s.quantity);

    fillRect(doc, ML, rowY, CW, ROW_H, bg, LINE);

    setB(9);
    setTextClr(doc, SECONDARY);
    doc.text((s.name || "").toUpperCase(), colX[0] + 6, rowY + 14);

    setN(9);
    doc.text(String(s.quantity), colX[1] + colW[1] / 2, rowY + 14, {
      align: "center",
    });
    doc.text(rupee(Number(s.price)), colX[2] + colW[2] - 6, rowY + 14, {
      align: "right",
    });
    setB(9);
    doc.text(rupee(lineTotal), colX[3] + colW[3] - 6, rowY + 14, {
      align: "right",
    });
    rowY += ROW_H;
  });

  for (let i = 0; i < Math.max(0, 3 - (q.services || []).length); i++) {
    fillRect(doc, ML, rowY, CW, ROW_H + SPEC_H, WHITE, "#e5e7eb");
    rowY += ROW_H + SPEC_H;
  }
  hline(doc, ML, rowY, CW, "#d1d5db");

  const bottomY = rowY + 60;
  const trmW = CW * 0.47;
  const totW = CW * 0.47;
  const totX = ML + CW - totW;

  setN(7);
  let tBoxH = 40;
  termLines.forEach((t: string, i: number) => {
    tBoxH += doc.splitTextToSize(`${i + 1}. ${t}`, trmW - 10).length * 8 + 3;
  });

  setDraw(doc, LINE);
  doc.rect(ML, bottomY, trmW, tBoxH, "S");
  setB(8.5);
  setTextClr(doc, SECONDARY);
  doc.text("Terms & Conditions", ML + 8, bottomY + 12);
  hline(doc, ML + 8, bottomY + 16, trmW - 10, LINE);

  let tty = bottomY + 28;
  termLines.forEach((t: string, i: number) => {
    setN(7.5);
    setTextClr(doc, MUTED);
    doc.splitTextToSize(`${i + 1}. ${t}`, trmW - 16).forEach((l: string) => {
      doc.text(l, ML + 8, tty);
      tty += 9;
    });
    tty += 3;
  });

  let trY = bottomY + 2;

  const totRows: [string, string, boolean][] = [
    ["SUBTOTAL", rupee(subtotal), false],
    ["DISCOUNT", "-" + rupee(discount), false],
    ["SUBTOTAL LESS DISCOUNT", rupee(subtotal - discount), true],
    ["GST (18%)", rupee(tax), false],
  ];

  totRows.forEach(([lbl, val, highlight]) => {
    setB(8.5);
    setTextClr(doc, highlight ? PRIMARY : SECONDARY);
    doc.text(lbl, totX, trY + 10);
    setN(8.5);
    setTextClr(doc, SECONDARY);
    doc.text(val, totX + totW - 4, trY + 10, { align: "right" });
    if (lbl === "DISCOUNT") hline(doc, totX, trY + 14, totW, LINE);
    trY += 16;
  });

  trY += 6;
  hline(doc, totX, trY, totW, PRIMARY);
  setB(10);
  setTextClr(doc, PRIMARY);
  doc.text("QUOTE TOTAL", totX + 6, trY + 16);
  setB(16);
  setTextClr(doc, SECONDARY);
  doc.text(
    (fontOk ? "₹" : "Rs.") +
      total.toLocaleString("en-IN", { maximumFractionDigits: 0 }),
    totX + totW - 6,
    trY + 19,
    { align: "right" },
  );

  const sigY = trY + 45;
  setB(9);
  setTextClr(doc, PRIMARY);
  doc.text(`FOR ${companyName.toUpperCase()}`, totX + totW / 2, sigY, {
    align: "center",
  });

  hline(doc, totX + totW / 2 - 50, sigY + 35, 100, LINE);

  setB(8);
  setTextClr(doc, SECONDARY);
  doc.text("AUTHORIZED SIGNATORY / DIRECTOR", totX + totW / 2, sigY + 45, {
    align: "center",
  });

  const FY = PH - 35;
  setN(8.5);
  setTextClr(doc, MUTED);
  doc.text(companyWebsite.toLowerCase(), PW / 2, FY, { align: "center" });

  setDraw(doc, PRIMARY);
  doc.setLineWidth(1);
  doc.rect(15, 15, PW - 30, PH - 30, "S");

  return doc;
}
