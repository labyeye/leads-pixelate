import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { autopilotAPI, socialAPI } from "@/services/api";
import { AutopilotPanel } from "@/components/social/AutopilotPanel";
import { AutopilotPosts } from "@/components/social/AutopilotPosts";
import SocialAutopilotPage from "@/pages/SocialAutopilotPage";

vi.mock("@/services/api", () => ({
  autopilotAPI: { get: vi.fn(), update: vi.fn(), run: vi.fn(), createOrder: vi.fn(), verify: vi.fn() },
  socialAPI: { getPosts: vi.fn(), approvePost: vi.fn(), rejectPost: vi.fn(), deletePost: vi.fn() },
}));

let role = "admin";
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { role } }) }));
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: any) => <div>{children}</div> }));

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const status = (over: any = {}) => ({
  configured: true,
  price: 149900,
  trialDays: 3,
  entitlement: { state: "trial", endsAt: inDays(2) },
  settings: { enabled: true, postsPerDay: 1, tone: "", language: "English", notes: "", reviewFirst: false, accountIds: [] },
  running: false,
  lastRunAt: null,
  lastError: "",
  monthCount: 3,
  monthlyCap: 62,
  accounts: [{ _id: "a1", platform: "instagram", accountName: "ig-account" }],
  ...over,
});
const toast = vi.fn();
const mockStatus = (over?: any) => vi.mocked(autopilotAPI.get).mockResolvedValue({ success: true, data: status(over) });

beforeEach(() => {
  vi.clearAllMocks();
  role = "admin";
});

describe("AutopilotPanel", () => {
  it("shows the trial countdown, price and month usage", async () => {
    mockStatus();
    render(<AutopilotPanel toast={toast} />);
    expect(await screen.findByText(/Free trial — 2 day\(s\) left/)).toBeInTheDocument();
    expect(screen.getByText(/Then ₹1,499\/month/)).toBeInTheDocument();
    expect(screen.getByText(/3 \/ 62 posts generated this month/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Subscribe · ₹1,499/ })).toBeInTheDocument();
  });

  it("expired trial asks to subscribe and won't let a paused Autopilot be switched on", async () => {
    mockStatus({ entitlement: { state: "expired", endsAt: null }, settings: { ...status().settings, enabled: false } });
    render(<AutopilotPanel toast={toast} />);
    expect(await screen.findByText(/access has ended/)).toBeInTheDocument();
    expect(screen.getAllByRole("switch")[0]).toBeDisabled();
  });

  it("warns when the server has no API keys and blocks enabling with no accounts", async () => {
    mockStatus({ configured: false, accounts: [], settings: { ...status().settings, enabled: false } });
    render(<AutopilotPanel toast={toast} />);
    expect(await screen.findByText(/isn't switched on for this server/)).toBeInTheDocument();
    expect(screen.getAllByRole("switch")[0]).toBeDisabled();
  });

  it("pausing sends enabled:false", async () => {
    mockStatus();
    vi.mocked(autopilotAPI.update).mockResolvedValue({ success: true });
    render(<AutopilotPanel toast={toast} />);
    await screen.findByText(/Free trial/);
    fireEvent.click(screen.getAllByRole("switch")[0]);
    await waitFor(() => expect(autopilotAPI.update).toHaveBeenCalledWith({ enabled: false }));
  });
});

describe("AutopilotPosts", () => {
  const post = (id: string, status: string, over: any = {}) => ({
    _id: id,
    caption: `caption ${id}`,
    imageUrl: "",
    platforms: ["instagram"],
    scheduledAt: inDays(1),
    status,
    ...over,
  });

  it("splits live posts from history, hides drafts, and approves pending ones", async () => {
    vi.mocked(socialAPI.getPosts).mockResolvedValue({
      success: true,
      count: 4,
      data: [post("p1", "SCHEDULED"), post("p2", "PENDING_APPROVAL"), post("p3", "FAILED", { failureReason: "token expired" }), post("p4", "DRAFT")],
    });
    vi.mocked(socialAPI.approvePost).mockResolvedValue({ success: true, data: {} });
    render(<AutopilotPosts toast={toast} />);

    expect(await screen.findByText("Coming up (2)")).toBeInTheDocument();
    expect(socialAPI.getPosts).toHaveBeenCalledWith({ source: "autopilot" });
    expect(screen.getByText("Recently published")).toBeInTheDocument();
    expect(screen.getByText("token expired")).toBeInTheDocument();
    expect(screen.queryByText("caption p4")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Approve/ }));
    await waitFor(() => expect(socialAPI.approvePost).toHaveBeenCalledWith("p2"));
  });

  it("shows an empty state", async () => {
    vi.mocked(socialAPI.getPosts).mockResolvedValue({ success: true, count: 0, data: [] });
    render(<AutopilotPosts toast={toast} />);
    expect(await screen.findByText(/Nothing queued yet/)).toBeInTheDocument();
  });
});

describe("SocialAutopilotPage", () => {
  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/social-autopilot"]}>
        <Routes>
          <Route path="/social-autopilot" element={<SocialAutopilotPage />} />
          <Route path="/social-planner" element={<div>planner-page</div>} />
        </Routes>
      </MemoryRouter>,
    );

  it("renders settings and posts for admins", async () => {
    mockStatus();
    vi.mocked(socialAPI.getPosts).mockResolvedValue({ success: true, count: 0, data: [] });
    renderPage();
    expect(await screen.findByText(/Free trial/)).toBeInTheDocument();
    expect(await screen.findByText(/Nothing queued yet/)).toBeInTheDocument();
  });

  it("sends other roles back to the planner", async () => {
    role = "sales_executive";
    renderPage();
    expect(await screen.findByText("planner-page")).toBeInTheDocument();
    expect(autopilotAPI.get).not.toHaveBeenCalled();
  });
});
