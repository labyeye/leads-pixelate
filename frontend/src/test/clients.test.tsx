import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as XLSX from "xlsx";
import { clientsAPI } from "@/services/api";
import { downloadCSV } from "@/lib/csvExport";
import { downloadPDF, downloadXLSX } from "@/lib/tableExport";
import { ExportFieldsDialog, type ExportField } from "@/components/export/ExportFieldsDialog";
import { ImportClientsDialog } from "@/components/clients/ImportClientsDialog";
import ClientsPage from "@/pages/ClientsPage";

vi.mock("@/services/api", () => ({
  clientsAPI: { getAll: vi.fn(), importBulk: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/csvExport", () => ({ downloadCSV: vi.fn() }));
vi.mock("@/lib/tableExport", () => ({
  downloadXLSX: vi.fn().mockResolvedValue(undefined),
  downloadPDF: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/hooks/usePermission", () => ({ usePermission: () => ({ can: () => true }) }));
vi.mock("@/components/ui/Notification", () => ({ useNotify: () => ({ error: vi.fn(), success: vi.fn() }) }));

const fields: ExportField[] = [
  { key: "name", label: "Name", get: (c) => c.name },
  { key: "addedBy", label: "Added By", get: (c) => c.createdBy?.name || "" },
];
const data = [{ name: "Ravi", createdBy: { name: "Asha" } }];
const today = new Date().toISOString().slice(0, 10);

beforeEach(() => vi.clearAllMocks());

describe("ExportFieldsDialog", () => {
  it("stays CSV-only for existing callers", async () => {
    render(<ExportFieldsDialog open onOpenChange={() => {}} fields={fields} data={data} filenamePrefix="leads" />);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(downloadCSV).toHaveBeenCalledWith(`leads-${today}.csv`, ["Name", "Added By"], [["Ravi", "Asha"]]));
    expect(downloadXLSX).not.toHaveBeenCalled();
  });

  it("offers Excel, PDF and CSV and exports the chosen columns in the chosen format", async () => {
    const close = vi.fn();
    render(
      <ExportFieldsDialog
        open
        onOpenChange={close}
        title="Export Clients"
        fields={fields}
        data={data}
        filenamePrefix="clients"
        formats={["xlsx", "pdf", "csv"]}
        documentTitle="Clients"
      />,
    );
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Excel", "PDF", "CSV"]);

    fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));
    await waitFor(() =>
      expect(downloadXLSX).toHaveBeenCalledWith(`clients-${today}.xlsx`, ["Name", "Added By"], [["Ravi", "Asha"]], "Clients"),
    );
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));

    fireEvent.click(screen.getByRole("radio", { name: "PDF" }));
    fireEvent.click(screen.getByLabelText("Added By")); // untick a column
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    await waitFor(() => expect(downloadPDF).toHaveBeenCalledWith(`clients-${today}.pdf`, "Clients", ["Name"], [["Ravi"]]));
  });

  it("shows an error and stays open when the export fails", async () => {
    vi.mocked(downloadXLSX).mockRejectedValueOnce(new Error("chunk failed"));
    const close = vi.fn();
    render(<ExportFieldsDialog open onOpenChange={close} fields={fields} data={data} filenamePrefix="c" formats={["xlsx", "csv"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));
    expect(await screen.findByText(/Export failed/)).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
});

describe("ImportClientsDialog", () => {
  const sheet = (rows: unknown[][]) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
    return new File([XLSX.write(wb, { type: "array", bookType: "xlsx" })], "clients.xlsx");
  };
  const HEAD = ["Name", "Company", "E-mail ID", "Mobile", "Address", "Business Type"];
  const upload = (file: File) => fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });

  it("reads the sheet, maps loose headers, ignores blank rows and sends clean rows", async () => {
    vi.mocked(clientsAPI.importBulk).mockResolvedValue({ success: true, imported: 1, skipped: [], message: "" });
    const onImported = vi.fn();
    render(<ImportClientsDialog open onOpenChange={() => {}} onImported={onImported} />);

    upload(sheet([HEAD, ["Ravi", "Acme", "ravi@acme.com", 9876543210, "Pune", "Mfg"], ["", "", "", "", "", ""]]));
    expect(await screen.findByText(/row found/)).toHaveTextContent("1 row found"); // blank trailing row ignored

    fireEvent.click(screen.getByRole("button", { name: /Import 1 client/ }));
    await waitFor(() =>
      expect(clientsAPI.importBulk).toHaveBeenCalledWith([
        { name: "Ravi", company: "Acme", email: "ravi@acme.com", phone: "9876543210", address: "Pune", businessType: "Mfg" },
      ]),
    );
    expect(await screen.findByText(/imported/)).toBeInTheDocument();
    expect(onImported).toHaveBeenCalled();
  });

  it("rejects a file that lacks a required column before calling the server", async () => {
    render(<ImportClientsDialog open onOpenChange={() => {}} onImported={() => {}} />);
    upload(sheet([["Name", "Company", "Email", "Phone", "Business Type"], ["Ravi", "Acme", "r@a.com", "9876543210", "Mfg"]]));
    expect(await screen.findByText(/Missing column\(s\): Address/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Import/ })).toBeDisabled();
    expect(clientsAPI.importBulk).not.toHaveBeenCalled();
  });

  it("sends big files in chunks and reports skipped rows with the sheet's row number", async () => {
    vi.mocked(clientsAPI.importBulk)
      .mockResolvedValueOnce({ success: true, imported: 500, skipped: [], message: "" })
      .mockResolvedValueOnce({ success: true, imported: 0, skipped: [{ row: 2, name: "Row501", reason: "Please add an address" }], message: "" });
    render(<ImportClientsDialog open onOpenChange={() => {}} onImported={() => {}} />);

    const body = Array.from({ length: 501 }, (_, i) => [`Row${i + 1}`, "Acme", `u${i}@acme.com`, "9876543210", "Pune", "Mfg"]);
    upload(sheet([HEAD, ...body]));
    fireEvent.click(await screen.findByRole("button", { name: /Import 501 clients/ }));

    expect(await screen.findByText(/Row 502/)).toHaveTextContent("Row 502 (Row501):");
    expect(clientsAPI.importBulk).toHaveBeenCalledTimes(2);
    expect(vi.mocked(clientsAPI.importBulk).mock.calls[0][0]).toHaveLength(500);
    expect(vi.mocked(clientsAPI.importBulk).mock.calls[1][0]).toHaveLength(1);
  });

  it("offers a template download", () => {
    render(<ImportClientsDialog open onOpenChange={() => {}} onImported={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Download template/ }));
    expect(downloadXLSX).toHaveBeenCalledWith(
      "clients-import-template.xlsx",
      expect.arrayContaining(["Name", "Email", "Business Type"]),
      expect.any(Array),
      "Clients",
    );
  });
});

describe("ClientsPage", () => {
  it("shows who added each client, with a dash for older clients, plus Import and Export", async () => {
    vi.mocked(clientsAPI.getAll).mockResolvedValue({
      success: true,
      count: 2,
      total: 2,
      data: [
        { _id: "1", name: "Ravi", company: "Acme", email: "r@a.com", phone: "9876543210", createdBy: { name: "Asha" }, createdAt: "2026-09-01T10:00:00Z" },
        { _id: "2", name: "Old Client", company: "Legacy", email: "o@l.com", phone: "9876543211", createdAt: "2025-01-01T10:00:00Z" },
      ],
    });
    render(<ClientsPage />);

    expect(await screen.findByText("Ravi")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Added By" })).toBeInTheDocument();
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Import Excel/ }));
    expect(await screen.findByText("Import clients from Excel")).toBeInTheDocument();
  });

  it("export offers Excel/PDF/CSV and lists Added By as a column", async () => {
    vi.mocked(clientsAPI.getAll).mockResolvedValue({
      success: true,
      count: 1,
      total: 1,
      data: [{ _id: "1", name: "Ravi", company: "Acme", email: "r@a.com", phone: "9876543210", createdBy: { name: "Asha" } }],
    });
    render(<ClientsPage />);
    await screen.findByText("Ravi");
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(await screen.findByRole("radio", { name: "Excel" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "PDF" })).toBeInTheDocument();
    expect(screen.getByLabelText("Added By")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));
    await waitFor(() => expect(downloadXLSX).toHaveBeenCalled());
    const [, headers, rows] = vi.mocked(downloadXLSX).mock.calls[0];
    expect(headers).toContain("Added By");
    expect(rows[0][headers.indexOf("Added By")]).toBe("Asha");
  });
});
