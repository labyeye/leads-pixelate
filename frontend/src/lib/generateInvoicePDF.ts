import jsPDF from "jspdf";
import logo from "@/assets/images/NestLeads_Logo_Name.png";

const PRIMARY = "#024BAB";
const SECONDARY = "#111827";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const BG_HEADER = "#f3f4f6";
const WHITE = "#ffffff";

const PW = 595.28;
const PH = 841.89;
const ML = 28;
const MR = 28;
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

function hline(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  c: string,
  lw = 0.5,
) {
  setDraw(doc, c);
  doc.setLineWidth(lw);
  doc.line(x, y, x + w, y);
}

function vline(
  doc: jsPDF,
  x: number,
  y: number,
  h: number,
  c: string,
  lw = 0.5,
) {
  setDraw(doc, c);
  doc.setLineWidth(lw);
  doc.line(x, y, x, y + h);
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

  const companyName = settings?.companyName || "YOUR COMPANY NAME";
  const companyAddress = settings?.companyAddress || "";
  const companyPhone = settings?.companyPhone || "";
  const companyEmail = settings?.companyEmail || "";
  const companyGST = settings?.companyGST || "";
  const companyPAN = settings?.companyPAN || "";
  const companyState = settings?.companyState || "";
  const companyStateCode = settings?.companyStateCode || "";
  const companyWebsite = settings?.companyWebsite || "";

  const bankAccountName = settings?.bankAccountName || companyName;
  const bankAccountNumber = settings?.bankAccountNumber || "";
  const bankName = settings?.bankName || "";
  const bankIFSC = settings?.bankIFSC || "";
  const bankBranch = settings?.bankBranch || "";
  const bankAccountType = settings?.bankAccountType || "Current";

  const termLines: string[] =
    settings?.quotationTerms?.length > 0
      ? settings.quotationTerms
      : [
          "Payment is due within 30 days of invoice date.",
          "Quote invoice number in all payment references.",
          "Goods/services remain property of seller until paid in full.",
          "Interest @ 18% p.a. charged on overdue amounts.",
        ];

  const invoiceTitle = settings?.quotationTitle || "TAX INVOICE";
  const footerText =
    settings?.quotationFooter ||
    "This is a computer-generated invoice and does not require a physical signature.";

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

  const rupee = (n: number, dec = 2) =>
    (fontOk ? "₹" : "Rs.") +
    n.toLocaleString("en-IN", {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });

  const buyerStateCode = q.gst?.slice(0, 2) || "";
  const sellerStateCode = companyStateCode || companyGST?.slice(0, 2) || "";
  const isInterState =
    buyerStateCode && sellerStateCode
      ? buyerStateCode !== sellerStateCode
      : true;

  const subtotal = (q.services || []).reduce(
    (a: number, s: any) => a + Number(s.price) * Number(s.quantity),
    0,
  );
  const discount = Number(q.discount || 0);
  const taxableAmount = subtotal - discount;
  const TAX_RATE = 0.18;
  const igstAmt = isInterState ? taxableAmount * TAX_RATE : 0;
  const cgstAmt = !isInterState ? taxableAmount * (TAX_RATE / 2) : 0;
  const sgstAmt = !isInterState ? taxableAmount * (TAX_RATE / 2) : 0;
  const totalTax = igstAmt + cgstAmt + sgstAmt;
  const grandTotal = taxableAmount + totalTax;

  setDraw(doc, LINE);
  doc.setLineWidth(0.75);
  doc.rect(14, 14, PW - 28, PH - 28, "S");

  const HY = 22;
  const logoW = 40;
  const logoH = 52;
  const logoX = ML;

  try {
    const customLogo = settings?.logoUrl?.trim();
    if (customLogo) {
      if (customLogo.startsWith("data:")) {
        const mime = customLogo.split(";")[0].split(":")[1] || "image/png";
        const fmt = mime.includes("jpeg")
          ? "JPEG"
          : mime.includes("gif")
            ? "GIF"
            : "PNG";
        doc.addImage(customLogo, fmt, logoX, HY, logoW, logoH);
      } else {
        const res = await fetch(customLogo);
        const blob = await res.blob();
        const b64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        doc.addImage(b64, "PNG", logoX, HY, logoW, logoH);
      }
    } else {
      doc.addImage(logo, "PNG", logoX, HY, logoW, logoH);
    }
  } catch {
    try {
      doc.addImage(logo, "PNG", logoX, HY, logoW, logoH);
    } catch {}
  }

  const tX = logoX + logoW + 12;
  let tY = HY + 10;

  setB(11);
  setTextClr(doc, PRIMARY);
  doc.text(companyName.toUpperCase(), tX, tY);
  tY += 13;

  setN(7.5);
  setTextClr(doc, MUTED);
  if (companyAddress) {
    doc.splitTextToSize(companyAddress, 200).forEach((l: string) => {
      doc.text(l, tX, tY);
      tY += 9;
    });
  }
  if (companyEmail || companyPhone) {
    const line = [companyEmail, companyPhone ? `Ph: ${companyPhone}` : ""]
      .filter(Boolean)
      .join("  |  ");
    doc.text(line, tX, tY);
    tY += 9;
  }
  if (companyWebsite) {
    doc.text(companyWebsite, tX, tY);
    tY += 9;
  }

  setB(7.5);
  setTextClr(doc, SECONDARY);
  if (companyGST) {
    doc.text(`GSTIN: ${companyGST}`, tX, tY);
    tY += 9;
  }
  if (companyPAN) {
    doc.text(`PAN: ${companyPAN}`, tX, tY);
    tY += 9;
  }
  if (companyState) {
    doc.text(
      `State: ${companyState}${companyStateCode ? ` (Code: ${companyStateCode})` : ""}`,
      tX,
      tY,
    );
  }

  const metaBoxW = 195;
  const metaBoxX = PW - MR - metaBoxW;
  const metaBoxY = HY;

  setB(13);
  setTextClr(doc, PRIMARY);
  doc.text(invoiceTitle.toUpperCase(), PW - MR, metaBoxY + 12, {
    align: "right",
  });

  setN(7);
  setTextClr(doc, MUTED);
  doc.text("Original for Recipient", PW - MR, metaBoxY + 22, {
    align: "right",
  });

  const metaRows: [string, string][] = [
    ["Invoice No.", q.number || "—"],
    [
      "Invoice Date",
      new Date(q.date || Date.now()).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    ],
    [
      "Due Date",
      new Date(q.date || Date.now()).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    ],
    ["Place of Service", q.companyName || q.clientName || "—"],
  ];

  const mRowH = 14;
  let mY = metaBoxY + 30;
  const colLW = 90;
  const colVW = metaBoxW - colLW;

  metaRows.forEach(([lbl, val]) => {
    fillRect(doc, metaBoxX, mY, colLW, mRowH, BG_HEADER, LINE);
    fillRect(doc, metaBoxX + colLW, mY, colVW, mRowH, WHITE, LINE);
    setB(7);
    setTextClr(doc, MUTED);
    doc.text(lbl, metaBoxX + 4, mY + 9);
    setN(7);
    setTextClr(doc, SECONDARY);
    doc.text(val.toString(), metaBoxX + colLW + 4, mY + 9);
    mY += mRowH;
  });

  const HR1 = Math.max(HY + logoH + 8, mY + 8);
  hline(doc, ML, HR1, CW, LINE, 0.75);

  const billY = HR1 + 8;
  const halfCW = CW / 2 - 4;

  setDraw(doc, LINE);
  doc.setLineWidth(0.5);

  const billLines: string[] = [];
  if (q.companyName) billLines.push(q.companyName.toUpperCase());
  if (q.clientName && q.companyName) billLines.push(q.clientName);
  else if (q.clientName) billLines.push(q.clientName.toUpperCase());
  if (q.address) {
    doc
      .splitTextToSize(q.address, halfCW - 12)
      .forEach((l: string) => billLines.push(l));
  }
  if (q.mobile) billLines.push(`Phone: ${q.mobile}`);
  if (q.gst) billLines.push(`GSTIN: ${q.gst}`);

  const billBoxH = Math.max(55, billLines.length * 10 + 20);

  doc.rect(ML, billY, halfCW, billBoxH, "S");
  setB(7);
  setTextClr(doc, PRIMARY);
  doc.text("BILL TO", ML + 5, billY + 10);
  hline(doc, ML + 5, billY + 13, halfCW - 10, LINE);

  let bly = billY + 22;
  billLines.forEach((l, i) => {
    if (i === 0) {
      setB(9);
      setTextClr(doc, SECONDARY);
    } else {
      setN(8);
      setTextClr(doc, MUTED);
    }
    doc.text(l, ML + 5, bly);
    bly += 10;
  });

  const shipX = ML + halfCW + 8;
  doc.rect(shipX, billY, halfCW, billBoxH, "S");
  setB(7);
  setTextClr(doc, PRIMARY);
  doc.text("SHIP TO / DELIVER TO", shipX + 5, billY + 10);
  hline(doc, shipX + 5, billY + 13, halfCW - 10, LINE);

  let sly = billY + 22;
  billLines.forEach((l, i) => {
    if (i === 0) {
      setB(9);
      setTextClr(doc, SECONDARY);
    } else {
      setN(8);
      setTextClr(doc, MUTED);
    }
    doc.text(l, shipX + 5, sly);
    sly += 10;
  });

  const tableY = billY + billBoxH + 10;

  const cols = {
    sno: CW * 0.05,
    desc: CW * 0.3,
    hsn: CW * 0.12,
    qty: CW * 0.07,
    unit: CW * 0.07,
    rate: CW * 0.13,
    disc: CW * 0.1,
    amt: CW * 0.16,
  };
  const colXs = {
    sno: ML,
    desc: ML + cols.sno,
    hsn: ML + cols.sno + cols.desc,
    qty: ML + cols.sno + cols.desc + cols.hsn,
    unit: ML + cols.sno + cols.desc + cols.hsn + cols.qty,
    rate: ML + cols.sno + cols.desc + cols.hsn + cols.qty + cols.unit,
    disc:
      ML + cols.sno + cols.desc + cols.hsn + cols.qty + cols.unit + cols.rate,
    amt:
      ML +
      cols.sno +
      cols.desc +
      cols.hsn +
      cols.qty +
      cols.unit +
      cols.rate +
      cols.disc,
  };

  const HDR_H = 18;
  fillRect(doc, ML, tableY, CW, HDR_H, PRIMARY);

  const headers: [keyof typeof colXs, string, "left" | "center" | "right"][] = [
    ["sno", "S.No", "center"],
    ["desc", "Description of Services / Goods", "left"],
    ["hsn", "HSN/SAC", "center"],
    ["qty", "Qty", "center"],
    ["unit", "Unit", "center"],
    ["rate", "Rate (Rs.)", "right"],
    ["disc", "Disc.", "center"],
    ["amt", "Amount (Rs.)", "right"],
  ];

  headers.forEach(([key, label, align]) => {
    setB(7);
    setTextClr(doc, "#ffffff");
    const cx =
      align === "center"
        ? colXs[key] + cols[key] / 2
        : align === "right"
          ? colXs[key] + cols[key] - 4
          : colXs[key] + 4;
    doc.text(label, cx, tableY + 12, { align });
  });

  const ROW_H = 20;
  let rowY = tableY + HDR_H;

  (q.services || []).forEach((s: any, i: number) => {
    const bg = i % 2 === 0 ? WHITE : BG_HEADER;
    const lineTotal = Number(s.price) * Number(s.quantity);
    fillRect(doc, ML, rowY, CW, ROW_H, bg, LINE);

    setN(7.5);
    setTextClr(doc, SECONDARY);
    doc.text(String(i + 1), colXs.sno + cols.sno / 2, rowY + 13, {
      align: "center",
    });

    setN(8);
    doc.text(s.name || "", colXs.desc + 4, rowY + 13);

    setN(7.5);
    if (s.hsnCode)
      doc.text(s.hsnCode, colXs.hsn + cols.hsn / 2, rowY + 13, {
        align: "center",
      });

    doc.text(String(s.quantity), colXs.qty + cols.qty / 2, rowY + 13, {
      align: "center",
    });
    doc.text("Nos", colXs.unit + cols.unit / 2, rowY + 13, { align: "center" });

    setB(8);
    doc.text(rupee(Number(s.price)), colXs.rate + cols.rate - 4, rowY + 13, {
      align: "right",
    });

    setN(7.5);
    doc.text("—", colXs.disc + cols.disc / 2, rowY + 13, { align: "center" });

    setB(8);
    doc.text(rupee(lineTotal), colXs.amt + cols.amt - 4, rowY + 13, {
      align: "right",
    });

    rowY += ROW_H;
  });

  for (let i = 0; i < Math.max(0, 3 - (q.services || []).length); i++) {
    fillRect(doc, ML, rowY, CW, ROW_H, i % 2 === 0 ? WHITE : BG_HEADER, LINE);
    rowY += ROW_H;
  }

  hline(doc, ML, rowY, CW, LINE, 0.75);

  const amtWordsY = rowY + 6;
  setN(7.5);
  setTextClr(doc, MUTED);
  doc.text(
    `Amount in Words: ${numberToWords(Math.round(grandTotal))} Rupees Only`,
    ML + 4,
    amtWordsY + 8,
  );
  hline(doc, ML, amtWordsY + 14, CW, LINE);

  const bottomY = amtWordsY + 18;
  const leftW = CW * 0.52;
  const rightW = CW * 0.46;
  const rightX = ML + leftW + CW * 0.02;

  setDraw(doc, LINE);
  const bankRows: [string, string][] = [
    ["Bank Name", bankName || "—"],
    ["Account No.", bankAccountNumber || "—"],
    ["Account Name", bankAccountName],
    ["IFSC Code", bankIFSC || "—"],
    ["Branch", bankBranch || "—"],
    ["Account Type", bankAccountType || "Current"],
  ];
  const bankBoxH = bankRows.length * 14 + 20;
  doc.rect(ML, bottomY, leftW, bankBoxH, "S");
  setB(7.5);
  setTextClr(doc, PRIMARY);
  doc.text("BANK DETAILS", ML + 5, bottomY + 10);
  hline(doc, ML + 5, bottomY + 13, leftW - 10, LINE);

  let bankY = bottomY + 22;
  bankRows.forEach(([lbl, val]) => {
    setB(7.5);
    setTextClr(doc, MUTED);
    doc.text(lbl, ML + 5, bankY);
    setN(7.5);
    setTextClr(doc, SECONDARY);
    doc.text(val, ML + leftW - 5, bankY, { align: "right" });
    hline(doc, ML + 5, bankY + 3, leftW - 10, BG_HEADER);
    bankY += 14;
  });

  const termsY = bottomY + bankBoxH + 6;
  const termsBoxH = termLines.length * 10 + 22;
  doc.rect(ML, termsY, leftW, termsBoxH, "S");
  setB(7.5);
  setTextClr(doc, PRIMARY);
  doc.text("TERMS & NOTES", ML + 5, termsY + 10);
  hline(doc, ML + 5, termsY + 13, leftW - 10, LINE);
  let termY = termsY + 22;
  termLines.forEach((t, i) => {
    setN(7);
    setTextClr(doc, MUTED);
    doc.splitTextToSize(`${i + 1}. ${t}`, leftW - 12).forEach((l: string) => {
      doc.text(l, ML + 5, termY);
      termY += 9;
    });
  });

  const totRows: [string, string, boolean][] = [
    ["Subtotal", rupee(subtotal), false],
    ["Taxable Amount", rupee(taxableAmount), false],
  ];
  if (isInterState) {
    totRows.push([`IGST (18%)`, rupee(igstAmt), false]);
  } else {
    totRows.push([`CGST (9%)`, rupee(cgstAmt), false]);
    totRows.push([`SGST (9%)`, rupee(sgstAmt), false]);
  }
  totRows.push(["Grand Total", rupee(grandTotal), true]);
  totRows.push(["(-) Amount Paid", rupee(Number(q.amountPaid || 0)), false]);

  const balanceDue = grandTotal - Number(q.amountPaid || 0);
  const totRowH = 16;
  const totBoxH = totRows.length * totRowH + totRowH + 16 + 40;

  doc.rect(rightX, bottomY, rightW, totBoxH, "S");

  let trY = bottomY + 4;
  totRows.forEach(([lbl, val, bold]) => {
    hline(doc, rightX, trY + totRowH - 1, rightW, LINE);
    if (bold) {
      setB(9);
      setTextClr(doc, PRIMARY);
    } else {
      setN(8);
      setTextClr(doc, SECONDARY);
    }
    doc.text(lbl, rightX + 5, trY + totRowH - 4);
    doc.text(val, rightX + rightW - 5, trY + totRowH - 4, { align: "right" });
    trY += totRowH;
  });

  trY += 2;
  fillRect(doc, rightX, trY, rightW, totRowH + 2, BG_HEADER, LINE);
  setB(9);
  setTextClr(doc, PRIMARY);
  doc.text("Balance Due", rightX + 5, trY + 12);
  setB(11);
  setTextClr(doc, balanceDue > 0 ? "#dc2626" : PRIMARY);
  doc.text(rupee(balanceDue), rightX + rightW - 5, trY + 12, {
    align: "right",
  });
  trY += totRowH + 8;

  setN(8);
  setTextClr(doc, MUTED);
  doc.text(`For ${companyName.toUpperCase()}`, rightX + rightW / 2, trY + 8, {
    align: "center",
  });
  hline(doc, rightX + rightW / 2 - 40, trY + 28, 80, LINE);
  setB(7.5);
  setTextClr(doc, SECONDARY);
  doc.text("Authorised Signatory", rightX + rightW / 2, trY + 36, {
    align: "center",
  });

  const hsnY = Math.max(termsY + termsBoxH, bottomY + totBoxH) + 12;
  const hsnCols = {
    code: CW * 0.2,
    taxable: CW * 0.25,
    rate: CW * 0.15,
    amt: CW * 0.2,
    total: CW * 0.2,
  };
  const hsnXs = {
    code: ML,
    taxable: ML + hsnCols.code,
    rate: ML + hsnCols.code + hsnCols.taxable,
    amt: ML + hsnCols.code + hsnCols.taxable + hsnCols.rate,
    total: ML + hsnCols.code + hsnCols.taxable + hsnCols.rate + hsnCols.amt,
  };

  fillRect(doc, ML, hsnY, CW, 16, PRIMARY);
  const hsnHeaders: [
    keyof typeof hsnXs,
    string,
    number,
    "left" | "center" | "right",
  ][] = [
    ["code", "HSN / SAC Code", hsnCols.code, "left"],
    ["taxable", "Taxable Value", hsnCols.taxable, "right"],
    [
      isInterState ? "rate" : "rate",
      isInterState ? "IGST Rate" : "CGST Rate",
      hsnCols.rate,
      "center",
    ],
    ["amt", isInterState ? "IGST Amt" : "CGST Amt", hsnCols.amt, "right"],
    ["total", "Total Tax", hsnCols.total, "right"],
  ];
  hsnHeaders.forEach(([key, label, w, align]) => {
    setB(7);
    setTextClr(doc, WHITE);
    const cx =
      align === "center"
        ? hsnXs[key] + w / 2
        : align === "right"
          ? hsnXs[key] + w - 4
          : hsnXs[key] + 4;
    doc.text(label, cx, hsnY + 11, { align });
  });

  const hsnMap: Record<string, number> = {};
  (q.services || []).forEach((s: any) => {
    const key = s.hsnCode || "—";
    hsnMap[key] = (hsnMap[key] || 0) + Number(s.price) * Number(s.quantity);
  });

  let hsnRowY = hsnY + 16;
  Object.entries(hsnMap).forEach(([code, val]) => {
    const tv = val - (discount * val) / subtotal;
    const taxAmt = tv * (isInterState ? TAX_RATE : TAX_RATE / 2);
    fillRect(doc, ML, hsnRowY, CW, 14, WHITE, LINE);
    setN(7.5);
    setTextClr(doc, SECONDARY);
    doc.text(code, hsnXs.code + 4, hsnRowY + 10);
    doc.text(rupee(tv), hsnXs.taxable + hsnCols.taxable - 4, hsnRowY + 10, {
      align: "right",
    });
    doc.text(
      isInterState ? "18%" : "9%",
      hsnXs.rate + hsnCols.rate / 2,
      hsnRowY + 10,
      { align: "center" },
    );
    doc.text(rupee(taxAmt), hsnXs.amt + hsnCols.amt - 4, hsnRowY + 10, {
      align: "right",
    });
    doc.text(rupee(taxAmt), hsnXs.total + hsnCols.total - 4, hsnRowY + 10, {
      align: "right",
    });
    hsnRowY += 14;
  });

  fillRect(doc, ML, hsnRowY, CW, 15, BG_HEADER, LINE);
  setB(8);
  setTextClr(doc, SECONDARY);
  doc.text("Total", hsnXs.code + 4, hsnRowY + 10);
  doc.text(
    rupee(taxableAmount),
    hsnXs.taxable + hsnCols.taxable - 4,
    hsnRowY + 10,
    { align: "right" },
  );
  doc.text(rupee(totalTax), hsnXs.amt + hsnCols.amt - 4, hsnRowY + 10, {
    align: "right",
  });
  doc.text(rupee(totalTax), hsnXs.total + hsnCols.total - 4, hsnRowY + 10, {
    align: "right",
  });
  hsnRowY += 15;

  const declY = hsnRowY + 10;
  const declW = CW * 0.6;
  setN(7.5);
  setTextClr(doc, MUTED);
  doc
    .splitTextToSize(
      "DECLARATION: We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct. All disputes are subject to " +
        (companyState || "local") +
        " jurisdiction only.",
      declW,
    )
    .forEach((l: string, i: number) => {
      doc.text(l, ML, declY + i * 9);
    });

  const footerY = PH - 26;
  setN(7);
  setTextClr(doc, MUTED);
  doc.text(footerText, PW / 2, footerY, { align: "center" });

  setDraw(doc, LINE);
  doc.setLineWidth(0.75);
  doc.rect(14, 14, PW - 28, PH - 28, "S");

  return doc;
}

function numberToWords(n: number): string {
  if (n === 0) return "Zero";
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function below100(num: number): string {
    if (num < 20) return ones[num];
    return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
  }
  function below1000(num: number): string {
    if (num < 100) return below100(num);
    return (
      ones[Math.floor(num / 100)] +
      " Hundred" +
      (num % 100 ? " " + below100(num % 100) : "")
    );
  }

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  let result = "";
  if (crore) result += below1000(crore) + " Crore ";
  if (lakh) result += below1000(lakh) + " Lakh ";
  if (thousand) result += below1000(thousand) + " Thousand ";
  if (rest) result += below1000(rest);

  return result.trim();
}
