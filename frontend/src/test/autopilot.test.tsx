import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { aiUsageAPI, autopilotAPI, socialAPI } from "@/services/api";
import { AutopilotPanel } from "@/components/social/AutopilotPanel";
import { AutopilotPosts } from "@/components/social/AutopilotPosts";
import { PostingPlan } from "@/components/social/autopilot/PostingPlan";
import AIUsagePage from "@/pages/AIUsagePage";
import SocialAutopilotPage from "@/pages/SocialAutopilotPage";
import SocialAutopilotSetupPage from "@/pages/SocialAutopilotSetupPage";
import SocialAutopilotReportPage from "@/pages/SocialAutopilotReportPage";
import { scanTarget, SCAN_STEPS } from "@/components/social/autopilot/ScanAnimation";
import { genIndex } from "@/components/social/autopilot/GenerationProgress";

vi.mock("@/services/api", () => ({
  autopilotAPI: {
    get: vi.fn(),
    update: vi.fn(),
    run: vi.fn(),
    analyze: vi.fn(),
    saveBrandProfile: vi.fn(),
    saveBrand: vi.fn(),
    uploadLogo: vi.fn(),
    deleteLogo: vi.fn(),
    saveIntro: vi.fn(),
    deleteIntroPdf: vi.fn(),
    revisePost: vi.fn(),
    stats: vi.fn(),
  },
  aiUsageAPI: { get: vi.fn() },
  socialAPI: { getPosts: vi.fn(), approvePost: vi.fn(), rejectPost: vi.fn(), deletePost: vi.fn() },
}));

// recharts measures its container with ResizeObserver, which jsdom does not have
(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let role = "admin";
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { role } }) }));
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: any) => <div>{children}</div> }));

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const status = (over: any = {}) => ({
  configured: true,
  plan: "",
  limits: { plan: "growth", daysPerWeek: 3, monthlyPosts: 14 },
  trialDays: 3,
  entitlement: { state: "trial", endsAt: inDays(2) },
  settings: {
    enabled: true,
    postsPerDay: 1,
    tone: "",
    language: "English",
    notes: "",
    reviewFirst: false,
    accountIds: [],
    schedule: { days: [], times: [] },
    contentTypes: [],
    lessons: [],
  },
  contentTypes: ["product", "tips"],
  intro: { text: "", pdfName: "" },
  running: false,
  progress: null,
  onboarded: true,
  firstApproved: true,
  analysis: { status: "idle", stage: "", error: "", note: "", at: null },
  brandProfile: {
    summary: "",
    industry: "",
    audience: "",
    tone: "",
    visualStyle: "",
    hashtagStyle: "",
    contentPillars: [],
    topPerformingThemes: [],
    doList: [],
    avoidList: [],
    palette: [],
  },
  brandKit: { logos: [], logoId: "", logoEnabled: true, logoMode: "fixed", logoPosition: "bottom-right", colors: [] },
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
    render(<MemoryRouter><AutopilotPanel toast={toast} /></MemoryRouter>);
    expect(await screen.findByText(/Free trial — 2 day\(s\) left/)).toBeInTheDocument();
    expect(screen.getByText(/Autopilot is included in your NestLeads plan/)).toBeInTheDocument();
    expect(screen.getByText(/3 \/ 62 posts generated this month/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Choose a plan/ })).toHaveAttribute("href", "/billing");
  });

  it("expired trial asks to subscribe and won't let a paused Autopilot be switched on", async () => {
    mockStatus({ entitlement: { state: "expired", endsAt: null }, settings: { ...status().settings, enabled: false } });
    render(<MemoryRouter><AutopilotPanel toast={toast} /></MemoryRouter>);
    expect(await screen.findByText(/access has ended/)).toBeInTheDocument();
    expect(screen.getByText(/Choose a NestLeads plan/)).toBeInTheDocument();
    expect(screen.getAllByRole("switch")[0]).toBeDisabled();
  });

  it("warns when the server has no API keys and blocks enabling with no accounts", async () => {
    mockStatus({ configured: false, accounts: [], settings: { ...status().settings, enabled: false } });
    render(<MemoryRouter><AutopilotPanel toast={toast} /></MemoryRouter>);
    expect(await screen.findByText(/isn't switched on for this server/)).toBeInTheDocument();
    expect(screen.getAllByRole("switch")[0]).toBeDisabled();
  });

  it("pausing sends enabled:false", async () => {
    mockStatus();
    vi.mocked(autopilotAPI.update).mockResolvedValue({ success: true });
    render(<MemoryRouter><AutopilotPanel toast={toast} /></MemoryRouter>);
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

const statsData = (over: any = {}) => ({
  range: { days: 30, since: inDays(-29) },
  totals: { generated: 12, posted: 7, pending: 2, scheduled: 1, rejected: 1, failed: 1, other: 0 },
  rates: { approvalRate: 88, avgApprovalHours: 3.5, revisedPosts: 2, revisions: 3 },
  series: [
    { date: "2026-09-19", generated: 1, posted: 1, rejected: 0 },
    { date: "2026-09-20", generated: 2, posted: 0, rejected: 1 },
  ],
  platforms: [{ platform: "instagram", count: 9 }, { platform: "facebook", count: 3 }],
  topics: [{ topic: "Sourdough basics", count: 3 }],
  next: { scheduledAt: inDays(1), status: "PENDING_APPROVAL", caption: "hi", platforms: ["instagram"] },
  ...over,
});
const mockStats = (over?: any) => vi.mocked(autopilotAPI.stats).mockResolvedValue({ success: true, data: statsData(over) } as any);

describe("Autopilot pages (Dashboard, Setup, Report)", () => {
  const renderPage = (path = "/social-autopilot") =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/social-autopilot" element={<SocialAutopilotPage />} />
          <Route path="/social-autopilot/setup" element={<SocialAutopilotSetupPage />} />
          <Route path="/social-autopilot/report" element={<SocialAutopilotReportPage />} />
          <Route path="/social-planner" element={<div>planner-page</div>} />
        </Routes>
      </MemoryRouter>,
    );
  const noPosts = () => vi.mocked(socialAPI.getPosts).mockResolvedValue({ success: true, count: 0, data: [] });

  beforeEach(() => {
    mockStats();
    vi.mocked(aiUsageAPI.get).mockResolvedValue({
      success: true,
      data: {
        plan: { id: "growth", expiresAt: inDays(20) },
        month: { start: inDays(-10), resetsAt: inDays(20) },
        autopilot: { used: 5, limit: 14, daysPerWeek: 3, enabled: true, state: "paid", endsAt: inDays(20) },
        aiCalls: { used: 0, limit: 500 },
        leads: { used: 0, limit: 10000 },
        team: { used: 1, limit: 50 },
      },
    } as any);
  });

  it("dashboard: shows what was done, what needs approval, plan usage and the queue", async () => {
    mockStatus();
    noPosts();
    renderPage();
    await waitFor(() => expect(screen.getByTestId("kpi-Created")).toHaveTextContent("12"));
    expect(screen.getByTestId("kpi-Posted")).toHaveTextContent("7");
    expect(screen.getByTestId("kpi-Needs approval")).toHaveTextContent("2");
    expect(screen.getByTestId("kpi-Scheduled")).toHaveTextContent("1");
    expect(screen.getByTestId("kpi-Rejected")).toHaveTextContent("1");
    expect(autopilotAPI.stats).toHaveBeenCalledWith(30);
    expect(await screen.findByLabelText("Plan usage")).toHaveTextContent("5 / 14 posts this month");
    expect(screen.getByText(/You approve/)).toHaveTextContent("88%");
    expect(await screen.findByText(/Nothing queued yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Report" })).toHaveAttribute("href", "/social-autopilot/report");
    expect(screen.getByRole("link", { name: "Setup" })).toHaveAttribute("href", "/social-autopilot/setup");
  });

  it("dashboard: changing the range reloads the numbers, and pausing sends enabled:false", async () => {
    mockStatus();
    noPosts();
    vi.mocked(autopilotAPI.update).mockResolvedValue({ success: true });
    renderPage();
    await screen.findByTestId("kpi-Created");
    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    await waitFor(() => expect(autopilotAPI.stats).toHaveBeenCalledWith(7));
    fireEvent.click(screen.getByRole("switch", { name: /Autopilot on or off/ }));
    await waitFor(() => expect(autopilotAPI.update).toHaveBeenCalledWith({ enabled: false }));
  });

  it("dashboard sends a brand-new tenant to Setup first", async () => {
    mockStatus({ onboarded: false, settings: { ...status().settings, enabled: false } });
    noPosts();
    renderPage();
    expect(await screen.findByText(/Let's set up your Autopilot/)).toBeInTheDocument();
    expect(autopilotAPI.stats).not.toHaveBeenCalledWith(undefined);
  });

  it("report: shows totals, review-loop numbers, platforms and topics", async () => {
    mockStatus();
    renderPage("/social-autopilot/report");
    expect(await screen.findByTestId("tile-Posts created")).toHaveTextContent("12");
    expect(screen.getByTestId("tile-Posted")).toHaveTextContent("7");
    expect(screen.getByTestId("tile-Approval rate")).toHaveTextContent("88%");
    expect(screen.getByTestId("tile-Time to approve")).toHaveTextContent("3.5 h");
    expect(screen.getByTestId("tile-Posts you changed")).toHaveTextContent("2");
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText(/Sourdough basics/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "90 days" }));
    await waitFor(() => expect(autopilotAPI.stats).toHaveBeenCalledWith(90));
  });

  it("report: shows dashes until something was reviewed", async () => {
    mockStatus();
    mockStats({ totals: { generated: 0, posted: 0, pending: 0, scheduled: 0, rejected: 0, failed: 0, other: 0 }, rates: { approvalRate: null, avgApprovalHours: null, revisedPosts: 0, revisions: 0 }, platforms: [], topics: [], series: [] });
    renderPage("/social-autopilot/report");
    expect(await screen.findByTestId("tile-Approval rate")).toHaveTextContent("—");
    expect(screen.getByText(/appear once posts have been reviewed/)).toBeInTheDocument();
  });

  it("setup: shows the settings and the brand section once onboarded", async () => {
    mockStatus();
    renderPage("/social-autopilot/setup");
    expect(await screen.findByText(/What Autopilot knows about your business/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Re-scan Instagram/ })).toBeInTheDocument();
    expect(screen.getByText(/Ask me before every post/)).toBeInTheDocument();
  });

  it("setup: walks a new tenant through the wizard", async () => {
    mockStatus({ onboarded: false, settings: { ...status().settings, enabled: false } });
    vi.mocked(autopilotAPI.analyze).mockResolvedValue({ success: true, started: true });
    renderPage("/social-autopilot/setup");
    expect(await screen.findByText(/Let's set up your Autopilot/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tell us about your brand/)).toBeInTheDocument();

    // typing an intro saves it before moving on, then the account step offers the scan
    vi.mocked(autopilotAPI.saveIntro).mockResolvedValue({ success: true });
    fireEvent.change(screen.getByLabelText(/Tell us about your brand/), { target: { value: "We bake sourdough." } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(autopilotAPI.saveIntro).toHaveBeenCalledWith("We bake sourdough.", null));
    fireEvent.click(await screen.findByRole("button", { name: /Scan my profile/ }));
    await waitFor(() => expect(autopilotAPI.analyze).toHaveBeenCalledWith("a1"));
    expect(await screen.findByText(/Analysing your brand/)).toBeInTheDocument();
    expect(screen.getByText("Reading your profile")).toBeInTheDocument();
  });

  it("setup: asks a tenant with no connected account to connect one first", async () => {
    mockStatus({ onboarded: false, accounts: [], settings: { ...status().settings, enabled: false } });
    renderPage("/social-autopilot/setup");
    fireEvent.click(await screen.findByRole("button", { name: "Skip for now" }));
    expect(await screen.findByRole("link", { name: /Connect an account/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Scan my profile/ })).toBeDisabled();
  });

  it("sends other roles back to the planner from every page", async () => {
    role = "sales_executive";
    for (const path of ["/social-autopilot", "/social-autopilot/setup", "/social-autopilot/report"]) {
      const { unmount } = renderPage(path);
      expect(await screen.findByText("planner-page")).toBeInTheDocument();
      unmount();
    }
    expect(autopilotAPI.get).not.toHaveBeenCalled();
    expect(autopilotAPI.stats).not.toHaveBeenCalled();
  });
});

describe("progress mapping", () => {
  it("maps the server scan stage to a checklist position", () => {
    expect(scanTarget("running", "profile")).toBe(0);
    expect(scanTarget("running", "style")).toBe(2);
    expect(scanTarget("running", "")).toBe(0);
    expect(scanTarget("done", "profile_built")).toBe(SCAN_STEPS.length);
  });

  it("maps the generation stage to a pipeline position", () => {
    expect(genIndex(undefined)).toBe(-1);
    expect(genIndex("planning")).toBe(0);
    expect(genIndex("review")).toBe(2);
    expect(genIndex("done")).toBe(3);
  });
});

describe("PostingPlan", () => {
  it("saves the chosen days, times and kinds of post", () => {
    const onSave = vi.fn();
    render(<PostingPlan status={status() as any} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Wed" })); // untick Wednesday (Mon-Wed are the default 3 days)
    fireEvent.click(screen.getByRole("button", { name: "Sat" })); // pick Saturday instead
    fireEvent.click(screen.getByRole("button", { name: /Add a time/ }));
    fireEvent.change(screen.getByLabelText("Post time 1"), { target: { value: "09:30" } });
    fireEvent.click(screen.getByLabelText(/Tips & advice/)); // untick one kind
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const patch = onSave.mock.calls[0][0];
    expect(patch.schedule.days.sort()).toEqual([1, 2, 6]);
    expect(patch.schedule.times).toEqual(["09:30", "18:00"]);
    expect(patch.contentTypes).not.toContain("tips");
    expect(patch.contentTypes).toContain("product");
  });

  it("won't save without a day, time or kind of post", () => {
    render(<PostingPlan status={status({ settings: { ...status().settings, schedule: { days: [1], times: ["10:00"] } } }) as any} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mon" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

describe("post review", () => {
  it("asks Autopilot to fix a post from the owner's feedback", async () => {
    vi.mocked(socialAPI.getPosts).mockResolvedValue({
      success: true,
      count: 1,
      data: [{ _id: "p9", caption: "burnt bread", imageUrl: "", platforms: ["instagram"], scheduledAt: inDays(1), status: "PENDING_APPROVAL" }],
    });
    vi.mocked(autopilotAPI.revisePost).mockResolvedValue({ success: true });
    render(<AutopilotPosts toast={toast} />);
    fireEvent.click(await screen.findByRole("button", { name: /Request changes/ }));
    fireEvent.change(screen.getByLabelText("What should change?"), { target: { value: "bread looks burnt" } });
    fireEvent.click(screen.getByRole("button", { name: /Fix & regenerate/ }));
    await waitFor(() => expect(autopilotAPI.revisePost).toHaveBeenCalledWith("p9", "bread looks burnt"));
  });

  it("shows progress while a post is being fixed and hides the buttons", async () => {
    vi.mocked(socialAPI.getPosts).mockResolvedValue({
      success: true,
      count: 1,
      data: [{ _id: "p9", caption: "x", imageUrl: "", platforms: ["instagram"], scheduledAt: inDays(1), status: "PENDING_APPROVAL", autopilotMeta: { revising: true, revisions: 1 } }],
    });
    render(<AutopilotPosts toast={toast} />);
    expect(await screen.findByText(/Fixing this post from your feedback/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();
  });
});

describe("plan limits in the posting plan", () => {
  it("stops at the plan's posting days per week", () => {
    render(<PostingPlan status={status({ limits: { plan: "starter", daysPerWeek: 1, monthlyPosts: 5 } }) as any} onSave={vi.fn()} />);
    expect(screen.getByText(/allows up to 1 posting day a week/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mon" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tue" })).toBeDisabled();
  });
});

describe("AIUsagePage", () => {
  const usage = (over: any = {}) => ({
    plan: { id: "growth", expiresAt: inDays(20) },
    month: { start: inDays(-10), resetsAt: inDays(20) },
    autopilot: { used: 5, limit: 14, daysPerWeek: 3, enabled: true, state: "paid", endsAt: inDays(20) },
    aiCalls: { used: 120, limit: 500 },
    leads: { used: 300, limit: 10000 },
    team: { used: 4, limit: 50 },
    ...over,
  });
  const renderUsage = () =>
    render(
      <MemoryRouter>
        <AIUsagePage />
      </MemoryRouter>,
    );

  it("shows every meter with its plan limit", async () => {
    vi.mocked(aiUsageAPI.get).mockResolvedValue({ success: true, data: usage() } as any);
    renderUsage();
    expect(await screen.findByText("Growth plan")).toBeInTheDocument();
    const autopilot = screen.getByTestId("meter-Social Autopilot posts");
    expect(autopilot).toHaveTextContent("5 / 14 posts");
    expect(autopilot).toHaveTextContent("up to 3 a week");
    expect(autopilot).toHaveTextContent("36% used");
    expect(screen.getByTestId("meter-AI voice calls")).toHaveTextContent("120 / 500 calls");
    expect(screen.getByTestId("meter-Leads this month")).toHaveTextContent("300 / 10,000 leads");
    expect(screen.getByTestId("meter-Team members")).toHaveTextContent("4 / 50 members");
    expect(screen.queryByText(/close to your plan limit/)).not.toBeInTheDocument();
  });

  it("warns near the limit and shows unlimited plans as unlimited", async () => {
    vi.mocked(aiUsageAPI.get).mockResolvedValue({
      success: true,
      data: usage({
        autopilot: { used: 13, limit: 14, daysPerWeek: 3, enabled: true, state: "trial", endsAt: inDays(2) },
        aiCalls: { used: 1, limit: 999999 },
        team: { used: 3, limit: 999 },
      }),
    } as any);
    renderUsage();
    expect(await screen.findByText(/close to your plan limit for Autopilot posts/)).toBeInTheDocument();
    expect(screen.getByTestId("meter-AI voice calls")).toHaveTextContent("Unlimited");
    expect(screen.getByTestId("meter-Team members")).toHaveTextContent("Unlimited");
    expect(screen.getByTestId("meter-Social Autopilot posts")).toHaveTextContent("Free trial until");
  });

  it("offers to set Autopilot up when it is off", async () => {
    vi.mocked(aiUsageAPI.get).mockResolvedValue({
      success: true,
      data: usage({ autopilot: { used: 0, limit: 14, daysPerWeek: 3, enabled: false, state: "none", endsAt: null } }),
    } as any);
    renderUsage();
    expect(await screen.findByRole("link", { name: "Set it up" })).toHaveAttribute("href", "/social-autopilot");
  });
});
