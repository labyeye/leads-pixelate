import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { getNavGroupsForRole } from "@/config/navigation";
import { whatsappAPI, leadsAPI } from "@/services/api";
import { AppSidebar } from "@/components/layout/AppSidebar";
import WhatsappMessagingPage from "@/pages/WhatsappMessagingPage";

vi.mock("@/services/api", () => ({
  whatsappAPI: {
    getCampaigns: vi.fn(),
    getCampaign: vi.fn(),
    getTemplates: vi.fn(),
    getStatus: vi.fn(),
    createCampaign: vi.fn(),
  },
  leadsAPI: { getAll: vi.fn() },
}));

let role = "admin";
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Asha", role }, logout: vi.fn() }),
}));
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: any) => <div>{children}</div> }));

const findItem = (r: any, title: string) =>
  getNavGroupsForRole(r)
    .flatMap((g) => g.items)
    .find((i) => i.title === title);

describe("WhatsApp navigation", () => {
  it("is one dropdown with every page for admins, and no flat WhatsApp group", () => {
    const wa = findItem("admin", "WhatsApp")!;
    expect(wa.children!.map((c) => c.title)).toEqual(["Inbox", "Campaigns", "Logs", "Setup"]);
    expect(wa.children!.map((c) => c.href)).toEqual([
      "/whatsapp/inbox",
      "/whatsapp/campaigns",
      "/whatsapp/logs",
      "/whatsapp/setup",
    ]);
    expect(getNavGroupsForRole("admin").map((g) => g.label)).not.toContain("WhatsApp");
  });

  it("hides admin-only Setup from sales executives and the whole dropdown from other roles", () => {
    expect(findItem("sales_executive", "WhatsApp")!.children!.map((c) => c.title)).toEqual([
      "Inbox",
      "Campaigns",
      "Logs",
    ]);
    expect(findItem("accountant", "WhatsApp")).toBeUndefined();
    expect(findItem("service_manager", "WhatsApp")).toBeUndefined();
  });

  it("child roles apply everywhere, e.g. admin-only Campaign Management", () => {
    const titles = (r: any) =>
      JSON.stringify(getNavGroupsForRole(r).flatMap((g) => g.items.filter((i) => i.title === "Campaigns")));
    expect(titles("admin")).toContain("Campaign Management");
    expect(titles("sales_executive")).not.toContain("Campaign Management");
  });
});

describe("AppSidebar WhatsApp dropdown", () => {
  const Where = () => <div data-testid="where">{useLocation().pathname}</div>;
  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <AppSidebar mobileOpen={false} onClose={() => {}} />
                <Where />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

  beforeEach(() => {
    role = "admin";
  });

  it("stays collapsed elsewhere, opens on click and links to every page", () => {
    renderAt("/");
    expect(screen.queryByRole("link", { name: "Inbox" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /WhatsApp/ }));
    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute("href", "/whatsapp/inbox");
    expect(screen.getByRole("link", { name: "Campaigns" })).toHaveAttribute("href", "/whatsapp/campaigns");
    expect(screen.getByRole("link", { name: "Logs" })).toHaveAttribute("href", "/whatsapp/logs");
    expect(screen.getByRole("link", { name: "Setup" })).toHaveAttribute("href", "/whatsapp/setup");
  });

  it("opens by itself when you are on one of its pages", () => {
    renderAt("/whatsapp/campaigns");
    expect(screen.getByRole("link", { name: "Campaigns" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inbox" })).toBeInTheDocument();
  });

  it("sales executives don't get Setup", () => {
    role = "sales_executive";
    renderAt("/whatsapp/inbox");
    expect(screen.getByRole("link", { name: "Logs" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Setup" })).not.toBeInTheDocument();
  });

  it("collapsed rail jumps to the first page instead of a dead dropdown", () => {
    const { container } = renderAt("/");
    fireEvent.click(container.querySelector("aside > button") as HTMLElement); // collapse
    fireEvent.click(screen.getByTitle("WhatsApp"));
    expect(screen.getByTestId("where")).toHaveTextContent("/whatsapp/inbox");
  });
});

describe("WhatsApp campaign wizard", () => {
  const number = (id: string, label: string) => ({
    phoneNumberId: id,
    label,
    businessName: "Acme",
    phoneNumber: `+91 ${id}`,
  });

  const setup = (numbers: any[]) => {
    vi.mocked(whatsappAPI.getCampaigns).mockResolvedValue({ success: true, count: 0, data: [] });
    vi.mocked(whatsappAPI.getTemplates).mockResolvedValue({
      success: true,
      count: 1,
      data: [
        {
          _id: "t1",
          name: "promo",
          displayName: "Promo Offer",
          bodyText: "Hi {{1}}",
          category: "MARKETING",
          language: "en",
          variableCount: 1,
          status: "APPROVED",
        },
      ],
    });
    vi.mocked(leadsAPI.getAll).mockResolvedValue({
      success: true,
      data: [{ _id: "l1", name: "Ravi Kumar", company: "Acme", phone: "9999999999", status: "DISCUSSION", source: "IndiaMART" }],
    } as any);
    vi.mocked(whatsappAPI.getStatus).mockResolvedValue({ success: true, data: { phoneNumbers: numbers } });
    vi.mocked(whatsappAPI.createCampaign).mockResolvedValue({ success: true, data: {} });
  };

  // Walks the real 4-step wizard: name -> template -> leads -> review/send.
  const runWizard = async () => {
    render(<WhatsappMessagingPage />);
    fireEvent.click(await screen.findByRole("button", { name: /New Campaign/ }));
    fireEvent.change(await screen.findByPlaceholderText(/Diwali Offer/), { target: { value: "Diwali blast" } });
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.click(await screen.findByText("Promo Offer"));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.click(await screen.findByText("Ravi Kumar"));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
  };

  beforeEach(() => vi.clearAllMocks());

  it("asks which number to send from when several are connected, and sends the first by default", async () => {
    setup([number("pn1", "Sales"), number("pn2", "Support")]);
    await runWizard();
    expect(await screen.findByText("Send from")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Send Campaign/ }));
    await waitFor(() =>
      expect(whatsappAPI.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Diwali blast", templateId: "t1", leadIds: ["l1"], phoneNumberId: "pn1" }),
      ),
    );
  });

  it("doesn't bother with a picker when there is one number", async () => {
    setup([number("pn1", "Sales")]);
    await runWizard();
    await screen.findByRole("button", { name: /Send Campaign/ });
    expect(screen.queryByText("Send from")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Send Campaign/ }));
    await waitFor(() =>
      expect(whatsappAPI.createCampaign).toHaveBeenCalledWith(expect.objectContaining({ phoneNumberId: "pn1" })),
    );
  });
});
