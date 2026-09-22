import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TradeDocumentsPage from "@/pages/TradeDocumentsPage";
import { getNavGroupsForRole } from "@/config/navigation";

const m = vi.hoisted(() => ({
  invoices: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/services/api", () => ({
  invoicesAPI: m.invoices,
  salesOrdersAPI: m.invoices,
  purchaseOrdersAPI: m.invoices,
  clientsAPI: { getAll: vi.fn().mockResolvedValue({ data: [{ name: "Ravi", company: "Acme", address: "MG Road", gst: "10ABC" }] }) },
  settingsAPI: { get: vi.fn().mockResolvedValue({ data: { companyName: "Bakery Co", logoUrl: "data:image/png;base64,AAA" } }) },
  productsAPI: { getAll: vi.fn().mockResolvedValue({ data: [{ _id: "p1", name: "Widget", price: 500, hsnCode: "8471" }] }) },
}));
const pdf = vi.hoisted(() => vi.fn());
vi.mock("@/lib/tradeDocPDF", () => ({ downloadTradeDocPDF: pdf }));
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/hooks/usePermission", () => ({ usePermission: () => ({ can: () => true }) }));
vi.mock("@/components/ui/Notification", () => ({ useNotify: () => ({ success: vi.fn(), error: vi.fn() }) }));

beforeEach(() => {
  Object.values(m.invoices).forEach((f) => f.mockReset());
  m.invoices.getAll.mockResolvedValue({ data: [] });
});

describe("Inventory", () => {
  it("has an Inventory section header holding products, services, quotations, price books and orders", () => {
    const groups = getNavGroupsForRole("admin");
    const inv = groups.find((g) => g.label === "Inventory")!;
    expect(inv.items.map((c) => c.title)).toEqual(["Products", "Services", "Price Books", "Quotations", "Sales Orders", "Purchase Orders", "Invoices"]);
    expect(groups.find((g) => g.label === "Business")!.items.map((c) => c.title)).toEqual(["Clients"]);
    // an accountant only sees the money paperwork
    const acct = getNavGroupsForRole("accountant").find((g) => g.label === "Inventory")!;
    expect(acct.items.map((c) => c.title)).toEqual(["Quotations", "Sales Orders", "Invoices"]);
  });

  it("creates an invoice from line items; picking a product fills its rate", async () => {
    m.invoices.create.mockResolvedValue({ data: {} });
    render(<TradeDocumentsPage kind="invoice" />);
    expect(await screen.findByText(/No invoices yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /New Invoice/ }));
    fireEvent.change(screen.getByLabelText(/^Client/), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Item 1 name"), { target: { value: "Widget" } });
    expect((screen.getByLabelText("Item 1 rate") as HTMLInputElement).value).toBe("500");
    fireEvent.change(screen.getByLabelText("Item 1 quantity"), { target: { value: "2" } });
    expect(screen.getByText("₹1,180")).toBeInTheDocument(); // 2 x 500 + 18% GST
    fireEvent.click(screen.getByRole("button", { name: /Create invoice/ }));
    await waitFor(() => expect(m.invoices.create).toHaveBeenCalled());
    expect(m.invoices.create.mock.calls[0][0]).toMatchObject({
      partyName: "Acme",
      status: "Draft",
      taxPercent: 18,
      items: [{ name: "Widget", hsnCode: "8471", quantity: 2, rate: 500 }],
    });
  });

  it("downloads a PDF with the company settings (its own logo) and the matching client", async () => {
    const doc = { _id: "d1", number: "INV-0001", partyName: "Acme", date: "2026-09-21", total: 100, status: "Sent", items: [{ name: "A", quantity: 1, rate: 100 }] };
    m.invoices.getAll.mockResolvedValue({ data: [doc] });
    render(<TradeDocumentsPage kind="invoice" />);
    fireEvent.click(await screen.findByLabelText("Download PDF INV-0001"));
    await waitFor(() => expect(pdf).toHaveBeenCalled());
    const [kind, d, settings, client] = pdf.mock.calls[0];
    expect(kind).toBe("invoice");
    expect(d.number).toBe("INV-0001");
    expect(settings.logoUrl).toContain("data:image/png");
    expect(client).toMatchObject({ company: "Acme", gst: "10ABC" });
  });

  it("won't save without an item", async () => {
    render(<TradeDocumentsPage kind="invoice" />);
    await screen.findByText(/No invoices yet/);
    fireEvent.click(screen.getByRole("button", { name: /New Invoice/ }));
    fireEvent.change(screen.getByLabelText(/^Client/), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: /Create invoice/ }));
    await Promise.resolve();
    expect(m.invoices.create).not.toHaveBeenCalled();
  });
});
