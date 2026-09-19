import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { downloadPDF, downloadXLSX } from "@/lib/tableExport";

// Real xlsx / jspdf (no mocks). Under Node the libraries write to the path they
// are given, so we point them at a temp dir and read the files back.
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "export-"));

describe("tableExport (real libraries)", () => {
  it("writes an Excel file with headers, rows and formula-looking text kept as text", async () => {
    const file = path.join(tmp(), "clients.xlsx");
    await downloadXLSX(file, ["Name", "Added By"], [["Ravi", "Asha"], ["=SUM(1,1)", "Meena"]], "Clients");

    const wb = XLSX.readFile(file, { cellStyles: true }); // cellStyles: also read column widths
    expect(wb.SheetNames).toEqual(["Clients"]);
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets.Clients, { header: 1 });
    expect(rows).toEqual([
      ["Name", "Added By"],
      ["Ravi", "Asha"],
      ["=SUM(1,1)", "Meena"],
    ]);
    expect(wb.Sheets.Clients.A3.t).toBe("s"); // a string cell, not a formula
    expect(wb.Sheets.Clients["!cols"]).toHaveLength(2);
  });

  it("writes a PDF that contains the title, headers and rows", async () => {
    const file = path.join(tmp(), "clients.pdf");
    await downloadPDF(file, "Clients", ["Name", "Added By"], [["Ravi Kumar", "Asha"]]);

    const pdf = fs.readFileSync(file, "latin1");
    expect(pdf.startsWith("%PDF-")).toBe(true);
    for (const text of ["Clients", "Name", "Added By", "Ravi Kumar", "Asha"]) {
      expect(pdf).toContain(text);
    }
  });

  it("goes landscape for wide tables so columns stay readable", async () => {
    const file = path.join(tmp(), "wide.pdf");
    const headers = Array.from({ length: 8 }, (_, i) => `H${i}`);
    await downloadPDF(file, "Wide", headers, [headers.map((h) => `${h}-v`)]);
    // A4 landscape is ~842 x 595 pt (jsPDF prints long floats)
    expect(fs.readFileSync(file, "latin1")).toMatch(/\/MediaBox \[0 0 841\.8\d+ 595\.2\d+\]/);
  });
});
