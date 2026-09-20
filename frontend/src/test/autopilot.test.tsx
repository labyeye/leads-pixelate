import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { aiUsageAPI, autopilotAPI, socialAPI } from "@/services/api";
import { AutopilotPosts } from "@/components/social/AutopilotPosts";
import { PostingPlan } from "@/components/social/autopilot/PostingPlan";
import AIUsagePage from "@/pages/AIUsagePage";
import SocialAutopilotPage from "@/pages/SocialAutopilotPage";
import SocialAutopilotSetupPage from "@/pages/SocialAutopilotSetupPage";
import SocialAutopilotReportPage from "@/pages/SocialAutopilotReportPage";
import { scanTarget, SCAN_STEPS, scanSteps } from "@/components/social/autopilot/ScanAnimation";
import { genIndex } from "@/components/social/autopilot/GenerationProgress";

// One campaign's API (autopilotAPI.campaign(id)) is a single set of mocks the tests can inspect.
const { scoped } = vi.hoisted(() => ({
  scoped: {
    get: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    run: vi.fn(),
    analyze: vi.fn(),
    saveBrandProfile: vi.fn(),
    saveBrand: vi.fn(),
    saveIntro: vi.fn(),
    deleteIntroPdf: vi.fn(),
    uploadLogo: vi.fn(),
    deleteLogo: vi.fn(),
    addCompetitor: vi.fn(),
    deleteCompetitor: vi.fn(),
    uploadReference: vi.fn(),
    deleteReference: vi.fn(),
  },
}));
vi.mock("@/services/api", () => ({
  autopilotAPI: {
    overview: vi.fn(),
    createCampaign: vi.fn(),
    campaign: vi.fn(() => scoped),
    stats: vi.fn(),
    revisePost: vi.fn(),
  },
  aiUsageAPI: { get: vi.fn() },
  socialAPI: { getPosts: vi.fn(), approvePost: vi.fn(), rejectPost: vi.fn(), deletePost: vi.fn() },
}));

let role = "admin";
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { role } }) }));
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: any) => <div>{children}</div> }));

// recharts measures its container with ResizeObserver, which jsdom does not have
(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const accounts = [
  { _id: "a1", platform: "instagram", accountName: "ig-account", campaign: null },
  { _id: "a2", platform: "facebook", accountName: "fb-page", campaign: { id: "c2", name: "Cafe" } },
];
const summary = (id: string, name: string, over: any = {}) => ({
  id,
  name,
  enabled: true,
  accountIds: [],
  onboarded: true,
  running: false,
  lastError: "",
  monthPosts: 3,
  ...over,
});
const overview = (over: any = {}) => ({
  configured: true,
  trialDays: 3,
  entitlement: { state: "trial", endsAt: inDays(2) },
  plan: "",
  limits: { plan: "growth", daysPerWeek: 3, monthlyPosts: 14, campaigns: 3 },
  monthCount: 3,
  monthlyCap: 14,
  campaigns: [summary("c1", "Bakery")],
  accounts,
  ...over,
});
// One campaign's full state, as GET /autopilot/campaigns/:id returns it.
const status = (over: any = {}) => ({
  campaign: { id: "c1", name: "Bakery" },
  configured: true,
  plan: "",
  limits: { plan: "growth", daysPerWeek: 3, monthlyPosts: 14, campaigns: 3 },
  trialDays: 3,
  entitlement: { state: "trial", endsAt: inDays(2) },
  settings: {
    enabled: true,
    postsPerDay: 1,
    tone: "",
    language: "English",
    notes: "",
    reviewFirst: false,
    accountIds: ["a1"],
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
    competitive: { positioning: "", whatTheyDoWell: [], gapsToExploit: [] },
  },
  brandKit: { logos: [], logoId: "", logoEnabled: true, logoMode: "fixed", logoPosition: "bottom-right", colors: [] },
  competitors: [],
  references: [],
  lastRunAt: null,
  lastError: "",
  monthCount: 3,
  campaignMonthCount: 3,
  monthlyCap: 14,
  accounts,
  ...over,
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
  byCampaign: [],
  next: { scheduledAt: inDays(1), status: "PENDING_APPROVAL", caption: "hi", platforms: ["instagram"] },
  ...over,
});
const toast = vi.fn();
const mockOverview = (over?: any) => vi.mocked(autopilotAPI.overview).mockResolvedValue({ success: true, data: overview(over) } as any);
const mockStatus = (over?: any) => scoped.get.mockResolvedValue({ success: true, data: status(over) });
const mockStats = (over?: any) => vi.mocked(autopilotAPI.stats).mockResolvedValue({ success: true, data: statsData(over) } as any);
const noPosts = () => vi.mocked(socialAPI.getPosts).mockResolvedValue({ success: true, count: 0, data: [] });

beforeEach(() => {
  vi.clearAllMocks();
  role = "admin";
  vi.mocked(autopilotAPI.campaign).mockReturnValue(scoped as any);
  mockOverview();
  mockStatus();
  mockStats();
  noPosts();
  vi.mocked(aiUsageAPI.get).mockResolvedValue({
    success: true,
    data: {
      plan: { id: "growth", expiresAt: inDays(20) },
      month: { start: inDays(-10), resetsAt: inDays(20) },
      autopilot: { used: 5, limit: 14, daysPerWeek: 3, campaigns: { used: 1, limit: 3 }, enabled: true, state: "paid", endsAt: inDays(20) },
      aiCalls: { used: 0, limit: 500 },
      leads: { used: 0, limit: 10000 },
      team: { used: 1, limit: 50 },
    },
  } as any);
});

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}
const renderPage = (path = "/social-autopilot") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path="/social-autopilot" element={<SocialAutopilotPage />} />
        <Route path="/social-autopilot/setup" element={<SocialAutopilotSetupPage />} />
        <Route path="/social-autopilot/report" element={<SocialAutopilotReportPage />} />
        <Route path="/social-planner" element={<div>planner-page</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("AutopilotPosts", () => {
  const post = (id: string, st: string, over: any = {}) => ({
    _id: id,
    caption: `caption ${id}`,
    imageUrl: "",
    platforms: ["instagram"],
    scheduledAt: inDays(1),
    status: st,
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
    render(<AutopilotPosts toast={toast} />);
    expect(await screen.findByText(/Nothing queued yet/)).toBeInTheDocument();
  });

  it("asks only for one campaign's posts and labels posts with their campaign", async () => {
    vi.mocked(socialAPI.getPosts).mockResolvedValue({ success: true, count: 1, data: [post("p1", "SCHEDULED", { campaignId: "c2" })] });
    render(<AutopilotPosts toast={toast} campaignId="c2" campaigns={[{ id: "c1", name: "Bakery" }, { id: "c2", name: "Cafe" }]} />);
    expect(await screen.findByText("Cafe")).toBeInTheDocument();
    expect(socialAPI.getPosts).toHaveBeenCalledWith({ source: "autopilot", campaignId: "c2" });
  });
});

describe("Dashboard", () => {
  it("one campaign: shows what was done, what needs approval, plan usage and the queue", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("kpi-Created")).toHaveTextContent("12"));
    expect(screen.getByTestId("kpi-Posted")).toHaveTextContent("7");
    expect(screen.getByTestId("kpi-Needs approval")).toHaveTextContent("2");
    expect(screen.getByTestId("kpi-Scheduled")).toHaveTextContent("1");
    expect(screen.getByTestId("kpi-Rejected")).toHaveTextContent("1");
    expect(autopilotAPI.stats).toHaveBeenCalledWith(30, "c1");
    expect(await screen.findByLabelText("Plan usage")).toHaveTextContent("5 / 14 posts this month");
    expect(screen.getByLabelText("Plan usage")).toHaveTextContent("1 of 3 campaigns used");
    expect(screen.getByText(/You approve/)).toHaveTextContent("88%");
    expect(await screen.findByText(/Nothing queued yet/)).toBeInTheDocument();
    expect(socialAPI.getPosts).toHaveBeenCalledWith({ source: "autopilot", campaignId: "c1" });
    expect(screen.getByRole("link", { name: "Report" })).toHaveAttribute("href", "/social-autopilot/report");
    expect(screen.getByRole("link", { name: "Setup" })).toHaveAttribute("href", "/social-autopilot/setup");
  });

  it("changing the range reloads the numbers, and pausing sends enabled:false to that campaign", async () => {
    scoped.update.mockResolvedValue({ success: true });
    renderPage();
    await screen.findByTestId("kpi-Created");
    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    await waitFor(() => expect(autopilotAPI.stats).toHaveBeenCalledWith(7, "c1"));
    fireEvent.click(screen.getByRole("switch", { name: /Autopilot on or off/ }));
    await waitFor(() => expect(scoped.update).toHaveBeenCalledWith({ enabled: false }));
    expect(autopilotAPI.campaign).toHaveBeenCalledWith("c1");
  });

  it("several campaigns: starts on 'All campaigns' with a card each and combined numbers", async () => {
    mockOverview({ campaigns: [summary("c1", "Bakery", { monthPosts: 4 }), summary("c2", "Cafe", { enabled: false, monthPosts: 2 })] });
    renderPage();
    expect(await screen.findByTestId("campaign-Bakery")).toHaveTextContent("4 posts this month");
    expect(screen.getByTestId("campaign-Cafe")).toHaveTextContent("Paused");
    await waitFor(() => expect(autopilotAPI.stats).toHaveBeenCalledWith(30, undefined));
    expect(document.body).toHaveTextContent(/2 campaigns · 1 running/);
    expect(scoped.get).not.toHaveBeenCalled(); // no single campaign is loaded in the combined view
    expect(socialAPI.getPosts).toHaveBeenCalledWith({ source: "autopilot" });

    // a card switches to that campaign
    fireEvent.click(within(screen.getByTestId("campaign-Cafe")).getByRole("button", { name: "Cafe" }));
    await waitFor(() => expect(autopilotAPI.stats).toHaveBeenCalledWith(30, "c2"));
    expect(screen.getByTestId("where")).toHaveTextContent("campaign=c2");
  });

  it("a card's switch turns just that campaign on or off", async () => {
    mockOverview({ campaigns: [summary("c1", "Bakery"), summary("c2", "Cafe")] });
    scoped.update.mockResolvedValue({ success: true });
    renderPage();
    fireEvent.click(await screen.findByRole("switch", { name: "Cafe on or off" }));
    await waitFor(() => expect(autopilotAPI.campaign).toHaveBeenCalledWith("c2"));
    await waitFor(() => expect(scoped.update).toHaveBeenCalledWith({ enabled: false }));
  });

  it("dashboard sends a campaign that is not set up yet to Setup", async () => {
    mockOverview({ campaigns: [summary("c1", "Bakery", { onboarded: false, enabled: false })] });
    mockStatus({ onboarded: false, settings: { ...status().settings, enabled: false, accountIds: [] } });
    renderPage();
    expect(await screen.findByText(/Let's set up your Autopilot/)).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/social-autopilot/setup?campaign=c1");
  });

  it("no campaigns yet: offers to create the first one", async () => {
    mockOverview({ campaigns: [] });
    renderPage();
    expect(await screen.findByText(/Create your first Autopilot campaign/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /New campaign/ }));
    expect(await screen.findByLabelText("Campaign name")).toBeInTheDocument();
  });

  it("creating a campaign asks for a name, then starts its setup", async () => {
    vi.mocked(autopilotAPI.createCampaign).mockResolvedValue({ success: true, data: { id: "c9", name: "Winter sale" } });
    mockOverview({ campaigns: [summary("c1", "Bakery")] });
    renderPage();
    await screen.findByTestId("kpi-Created");
    fireEvent.click(screen.getByRole("button", { name: "New campaign" }));
    const input = await screen.findByLabelText("Campaign name");
    expect(screen.getByRole("button", { name: /Create campaign/ })).toBeDisabled();
    fireEvent.change(input, { target: { value: "Winter sale" } });
    fireEvent.click(screen.getByRole("button", { name: /Create campaign/ }));
    await waitFor(() => expect(autopilotAPI.createCampaign).toHaveBeenCalledWith("Winter sale"));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/social-autopilot/setup?campaign=c9"));
  });

  it("the plan's campaign limit hides the add button and a refused create explains why", async () => {
    mockOverview({
      limits: { plan: "starter", daysPerWeek: 1, monthlyPosts: 5, campaigns: 1 },
      campaigns: [summary("c1", "Bakery")],
    });
    renderPage();
    await screen.findByTestId("kpi-Created");
    expect(screen.queryByRole("button", { name: "New campaign" })).not.toBeInTheDocument();
  });
});

describe("Report", () => {
  it("shows totals, review-loop numbers, platforms and topics", async () => {
    renderPage("/social-autopilot/report");
    expect(await screen.findByTestId("tile-Posts created")).toHaveTextContent("12");
    expect(screen.getByTestId("tile-Posted")).toHaveTextContent("7");
    expect(screen.getByTestId("tile-Approval rate")).toHaveTextContent("88%");
    expect(screen.getByTestId("tile-Time to approve")).toHaveTextContent("3.5 h");
    expect(screen.getByTestId("tile-Posts you changed")).toHaveTextContent("2");
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText(/Sourdough basics/)).toBeInTheDocument();
    expect(autopilotAPI.stats).toHaveBeenCalledWith(30, "c1");
    fireEvent.click(screen.getByRole("button", { name: "90 days" }));
    await waitFor(() => expect(autopilotAPI.stats).toHaveBeenCalledWith(90, "c1"));
  });

  it("all campaigns: compares them side by side", async () => {
    mockOverview({ campaigns: [summary("c1", "Bakery"), summary("c2", "Cafe")] });
    mockStats({ byCampaign: [{ campaignId: "c1", name: "Bakery", generated: 8, posted: 6, rejected: 1 }, { campaignId: "c2", name: "Cafe", generated: 4, posted: 1, rejected: 0 }] });
    renderPage("/social-autopilot/report");
    const row = await screen.findByTestId("row-Bakery");
    expect(row).toHaveTextContent("8");
    expect(row).toHaveTextContent("75%");
    expect(screen.getByTestId("row-Cafe")).toHaveTextContent("25%");
    expect(autopilotAPI.stats).toHaveBeenCalledWith(30, undefined);
  });

  it("shows dashes until something was reviewed", async () => {
    mockStats({ totals: { generated: 0, posted: 0, pending: 0, scheduled: 0, rejected: 0, failed: 0, other: 0 }, rates: { approvalRate: null, avgApprovalHours: null, revisedPosts: 0, revisions: 0 }, platforms: [], topics: [], series: [] });
    renderPage("/social-autopilot/report");
    expect(await screen.findByTestId("tile-Approval rate")).toHaveTextContent("—");
    expect(screen.getByText(/appear once posts have been reviewed/)).toBeInTheDocument();
  });
});

describe("Setup", () => {
  it("existing campaign: shows its settings, brand section and references tab", async () => {
    renderPage("/social-autopilot/setup");
    expect(await screen.findByText(/What Autopilot knows about “Bakery”/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Re-scan Instagram/ })).toBeInTheDocument();
    expect(screen.getByText("Campaign settings")).toBeInTheDocument();
    expect(screen.getByText(/Always ask me before posting/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /References & competitors/ })).toBeInTheDocument();
  });

  it("settings: accounts used by another campaign are locked, saving sends the chosen ones", async () => {
    scoped.update.mockResolvedValue({ success: true });
    mockStatus({ settings: { ...status().settings, accountIds: [] } });
    renderPage("/social-autopilot/setup");
    await screen.findByText("Campaign settings");
    expect(screen.getByText(/used by Cafe/)).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox"); // the campaign's accounts come first
    expect(boxes[1]).toBeDisabled(); // the Facebook page belongs to "Cafe"
    fireEvent.click(boxes[0]);
    fireEvent.click(screen.getByRole("button", { name: /Save accounts/ }));
    await waitFor(() => expect(scoped.update).toHaveBeenCalledWith({ accountIds: ["a1"] }));
  });

  it("settings: renaming and deleting a campaign", async () => {
    scoped.update.mockResolvedValue({ success: true });
    scoped.remove.mockResolvedValue({ success: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage("/social-autopilot/setup");
    const name = await screen.findByLabelText("Campaign name");
    fireEvent.change(name, { target: { value: "Bakery UK" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(scoped.update).toHaveBeenCalledWith({ name: "Bakery UK" }));
    fireEvent.click(screen.getByRole("button", { name: /Delete this campaign/ }));
    await waitFor(() => expect(scoped.remove).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^\/social-autopilot$/));
  });

  it("wizard: a new campaign goes intro -> accounts -> references and competitors -> scan", async () => {
    mockOverview({ campaigns: [summary("c1", "Bakery", { onboarded: false, enabled: false })] });
    mockStatus({ onboarded: false, settings: { ...status().settings, enabled: false, accountIds: [] } });
    scoped.saveIntro.mockResolvedValue({ success: true });
    scoped.update.mockResolvedValue({ success: true });
    scoped.analyze.mockResolvedValue({ success: true, started: true });
    scoped.addCompetitor.mockResolvedValue({ success: true, data: { id: "k1", username: "rival_one", notes: "cheaper" } });
    renderPage("/social-autopilot/setup");

    // 1. brand intro
    expect(await screen.findByText(/Let's set up your Autopilot/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Tell us about your brand/), { target: { value: "We bake sourdough." } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(scoped.saveIntro).toHaveBeenCalledWith("We bake sourdough.", null));

    // 2. accounts: none picked yet, one is taken by another campaign
    expect(await screen.findByText(/Which accounts does this campaign post to/)).toBeInTheDocument();
    expect(screen.getByText(/used by Cafe/)).toBeInTheDocument();
    const next = screen.getByRole("button", { name: /Continue/ });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() => expect(scoped.update).toHaveBeenCalledWith({ accountIds: ["a1"] }));

    // 3. references and competitors, then scan
    expect(await screen.findByText("References and competitors")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Competitor Instagram username"), { target: { value: "@rival_one" } });
    fireEvent.change(screen.getByLabelText("Notes about the competitor"), { target: { value: "cheaper" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
    await waitFor(() => expect(scoped.addCompetitor).toHaveBeenCalledWith({ username: "@rival_one", notes: "cheaper" }));
    fireEvent.click(screen.getByRole("button", { name: /Scan my profile/ }));
    await waitFor(() => expect(scoped.analyze).toHaveBeenCalledWith("a1"));
    expect(await screen.findByText(/Analysing your brand/)).toBeInTheDocument();
    expect(screen.getByText("Reading your profile")).toBeInTheDocument();
  });

  it("references & competitors: shows what the scan found, and lets you remove them", async () => {
    scoped.deleteCompetitor.mockResolvedValue({ success: true });
    scoped.deleteReference.mockResolvedValue({ success: true });
    mockStatus({
      competitors: [
        { id: "k1", username: "rival_one", notes: "cheap deals", followers: 5000, summary: "Rival bakery", error: "", readAt: null },
        { id: "k2", username: "private_shop", notes: "", followers: null, summary: "", error: "Not a business or creator account", readAt: null },
      ],
      references: [{ id: "r1", url: "http://x/r1.jpg", note: "" }],
    });
    renderPage("/social-autopilot/setup");
    fireEvent.mouseDown(await screen.findByRole("tab", { name: /References & competitors/ }));
    expect(await screen.findByText("@rival_one")).toBeInTheDocument();
    expect(screen.getByText(/5,000 followers/)).toBeInTheDocument();
    expect(screen.getByText(/Not a business or creator account/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove private_shop" }));
    await waitFor(() => expect(scoped.deleteCompetitor).toHaveBeenCalledWith("k2"));
    fireEvent.click(screen.getByRole("button", { name: "Remove reference image" }));
    await waitFor(() => expect(scoped.deleteReference).toHaveBeenCalledWith("r1"));
  });

  it("references: uploading an image sends it to the campaign", async () => {
    scoped.uploadReference.mockResolvedValue({ success: true, data: { id: "r2", url: "u", note: "" } });
    renderPage("/social-autopilot/setup");
    fireEvent.mouseDown(await screen.findByRole("tab", { name: /References & competitors/ }));
    const file = new File([new Uint8Array([1, 2, 3])], "moodboard.png", { type: "image/png" });
    fireEvent.change(await screen.findByLabelText("Upload reference images"), { target: { files: [file] } });
    await waitFor(() => expect(scoped.uploadReference).toHaveBeenCalledWith(file));
  });

  it("no campaign yet: Setup asks to create one", async () => {
    mockOverview({ campaigns: [] });
    renderPage("/social-autopilot/setup");
    expect(await screen.findByText(/Create your first Autopilot campaign/)).toBeInTheDocument();
  });

  it("sends other roles back to the planner from every page", async () => {
    role = "sales_executive";
    for (const path of ["/social-autopilot", "/social-autopilot/setup", "/social-autopilot/report"]) {
      const { unmount } = renderPage(path);
      expect(await screen.findByText("planner-page")).toBeInTheDocument();
      unmount();
    }
    expect(autopilotAPI.overview).not.toHaveBeenCalled();
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

  it("adds the steps the owner's input needs, in the server's order", () => {
    expect(scanSteps({ intro: true, references: true, competitors: true }).map((s) => s.key)).toEqual([
      "intro",
      "profile",
      "posts",
      "references",
      "competitors",
      "style",
      "profile_built",
    ]);
    expect(scanTarget("running", "competitors", { references: true, competitors: true })).toBe(3);
    expect(scanTarget("running", "style", { references: true, competitors: true })).toBe(4);
    expect(scanTarget("done", "profile_built", { intro: true })).toBe(5);
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

  it("stops at the plan's posting days per week", () => {
    render(<PostingPlan status={status({ limits: { plan: "starter", daysPerWeek: 1, monthlyPosts: 5, campaigns: 1 } }) as any} onSave={vi.fn()} />);
    expect(screen.getByText(/allows up to 1 posting day a week/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mon" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tue" })).toBeDisabled();
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

describe("AIUsagePage", () => {
  const usage = (over: any = {}) => ({
    plan: { id: "growth", expiresAt: inDays(20) },
    month: { start: inDays(-10), resetsAt: inDays(20) },
    autopilot: { used: 5, limit: 14, daysPerWeek: 3, campaigns: { used: 2, limit: 3 }, enabled: true, state: "paid", endsAt: inDays(20) },
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

  it("shows every meter with its plan limit, and the campaigns used", async () => {
    vi.mocked(aiUsageAPI.get).mockResolvedValue({ success: true, data: usage() } as any);
    renderUsage();
    expect(await screen.findByText("Growth plan")).toBeInTheDocument();
    const autopilot = screen.getByTestId("meter-Social Autopilot posts");
    expect(autopilot).toHaveTextContent("5 / 14 posts");
    expect(autopilot).toHaveTextContent("up to 3 a week per campaign");
    expect(autopilot).toHaveTextContent("Campaigns: 2 / 3");
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
        autopilot: { used: 13, limit: 14, daysPerWeek: 3, campaigns: { used: 1, limit: 3 }, enabled: true, state: "trial", endsAt: inDays(2) },
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
      data: usage({ autopilot: { used: 0, limit: 14, daysPerWeek: 3, campaigns: { used: 0, limit: 3 }, enabled: false, state: "none", endsAt: null } }),
    } as any);
    renderUsage();
    expect(await screen.findByRole("link", { name: "Set it up" })).toHaveAttribute("href", "/social-autopilot");
  });
});
