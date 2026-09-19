// Excel / PDF downloads for table data. xlsx and jspdf are large, so they are
// loaded only when someone actually exports (or downloads a template).
type Cell = string | number;

export async function downloadXLSX(
  filename: string,
  headers: string[],
  rows: Cell[][],
  sheetName = "Sheet1",
) {
  const XLSX = await import("xlsx");
  // Plain JS strings become string cells, so a value like "=SUM(A1)" stays text.
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map((h, i) => ({
    wch: Math.min(
      40,
      Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length)) + 2,
    ),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

export async function downloadPDF(
  filename: string,
  title: string,
  headers: string[],
  rows: Cell[][],
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({
    orientation: headers.length > 6 ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.text(
    `Generated ${new Date().toLocaleString("en-IN")} · ${rows.length} row${rows.length === 1 ? "" : "s"}`,
    14,
    21,
  );
  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => r.map((c) => String(c ?? ""))),
    startY: 25,
    styles: { fontSize: 8, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [2, 75, 171] },
  });
  doc.save(filename);
}
