const PDFDocument = require("pdfkit");

// Plain server-side quotation PDF, used when the caller (mobile app) has no PDF of its own.
// The web app sends its designer-template PDF instead. 18% GST, same as the apps' totals.
module.exports = function buildQuotationPdf(q, s = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const money = (n) =>
      "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
    const sub = (q.services || []).reduce((a, i) => a + i.price * i.quantity, 0);
    const disc = Number(q.discount) || 0;
    const tax = (sub - disc) * 0.18;

    doc.fontSize(18).text(s.companyName || "Quotation");
    doc.fontSize(9).fillColor("#555");
    [s.companyAddress, s.companyPhone, s.companyGST && `GST: ${s.companyGST}`]
      .filter(Boolean)
      .forEach((l) => doc.text(l));
    doc.moveDown().fillColor("#000").fontSize(14).text("QUOTATION");
    doc
      .fontSize(10)
      .text(`No: ${q.number}    Date: ${new Date(q.date).toLocaleDateString("en-IN")}`);
    doc.moveDown(0.5).text(`To: ${q.companyName || q.clientName}`);
    if (q.companyName) doc.text(`Attn: ${q.clientName}`);
    if (q.address) doc.text(q.address);
    if (q.gst) doc.text(`GST: ${q.gst}`);
    doc.moveDown(0.5).text(`Project: ${q.projectTitle}`).moveDown();

    const row = (a, b, c, d, bold) => {
      const y = doc.y;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica");
      doc.text(a, 40, y, { width: 260 });
      doc.text(b, 300, y, { width: 50, align: "right" });
      doc.text(c, 350, y, { width: 90, align: "right" });
      doc.text(d, 440, y, { width: 115, align: "right" });
      doc.moveDown(0.4);
    };
    row("Item", "Qty", "Price", "Amount", true);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke().moveDown(0.3);
    (q.services || []).forEach((i) =>
      row(i.name, String(i.quantity), money(i.price), money(i.price * i.quantity)),
    );
    doc.moveDown();
    row("", "", "Subtotal", money(sub));
    if (disc) row("", "", "Discount", "-" + money(disc));
    row("", "", "GST 18%", money(tax));
    row("", "", "Total", money(sub - disc + tax), true);
    doc.end();
  });
};
