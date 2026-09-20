import {
  COLORS, accountTakenBy, campaignPill, chartMax, competitorPayload, daysLeft, lineData, pctOf,
  pickCampaign, pieData, planPayload, scanStepIndex, scanSteps, shortDate, sortQueue, statePill,
  usageColor, usagePct,
} from '../src/lib/autopilot';

const series = (n: number) =>
  Array.from({length: n}, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    generated: i % 3,
    posted: i % 2,
    rejected: 0,
  }));

describe('usage', () => {
  it('turns used/limit into a capped percentage and a traffic-light colour', () => {
    expect(usagePct(5, 14)).toBe(36);
    expect(usagePct(20, 14)).toBe(100);
    expect(usagePct(3, 0)).toBe(0);
    expect(usageColor(50)).toBe(COLORS.posted);
    expect(usageColor(75)).toBe(COLORS.pending);
    expect(usageColor(95)).toBe(COLORS.rejected);
  });

  it('formats percentages of a total', () => {
    expect(pctOf(7, 12)).toBe('58%');
    expect(pctOf(0, 0)).toBe('—');
  });
});

describe('chart data', () => {
  it('labels only some points on long ranges', () => {
    const d = lineData(series(30), 'generated');
    expect(d).toHaveLength(30);
    expect(d[0].label).toBe('1 Sept');
    expect(d[1].label).toBe('');
    expect(d[7].label).not.toBe('');
    expect(d[29].label).not.toBe(''); // the last day is always labelled
    expect(lineData(series(7), 'posted').every(p => p.label !== '')).toBe(true);
  });

  it('keeps a sensible y scale', () => {
    expect(chartMax(series(3))).toBe(3);
    expect(chartMax([{date: '2026-09-01', generated: 9, posted: 2, rejected: 4}])).toBe(9);
  });

  it('formats an India calendar day without shifting it', () => {
    expect(shortDate('2026-09-20')).toBe('20 Sept');
  });

  it('only draws outcomes that happened', () => {
    const slices = pieData({generated: 10, posted: 6, pending: 2, scheduled: 0, rejected: 1, failed: 0, other: 1});
    expect(slices.map(s => s.label)).toEqual(['Posted', 'Waiting for approval', 'Rejected']);
    expect(slices.map(s => s.value)).toEqual([6, 2, 1]);
  });
});

describe('dashboard state', () => {
  const st = (enabled: boolean, state: string, endsAt: string | null = null) => ({
    settings: {enabled},
    entitlement: {state, endsAt},
  });
  it('shows Paused, trial countdown, Live or Needs a plan', () => {
    expect(statePill(st(false, 'paid')).text).toBe('Paused');
    expect(statePill(st(true, 'paid')).text).toBe('Live');
    expect(statePill(st(true, 'expired')).text).toBe('Needs a plan');
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
    expect(statePill(st(true, 'trial', soon)).text).toBe('Free trial · 2 day(s) left');
    expect(daysLeft(new Date(Date.now() - 1000).toISOString())).toBe(1);
  });

  it('puts posts waiting for approval first, then by time', () => {
    const q = sortQueue([
      {status: 'SCHEDULED', scheduledAt: '2026-09-20T05:00:00Z'},
      {status: 'PENDING_APPROVAL', scheduledAt: '2026-09-22T05:00:00Z'},
      {status: 'PENDING_APPROVAL', scheduledAt: '2026-09-21T05:00:00Z'},
    ]);
    expect(q.map(p => p.scheduledAt.slice(8, 10))).toEqual(['21', '22', '20']);
  });
});

describe('scan progress', () => {
  it('maps the server stage to a checklist position, with or without the intro step', () => {
    expect(scanStepIndex('running', 'profile', false)).toBe(0);
    expect(scanStepIndex('running', 'style', false)).toBe(2);
    expect(scanStepIndex('running', 'intro', true)).toBe(0);
    expect(scanStepIndex('running', 'profile', true)).toBe(1);
    expect(scanStepIndex('done', 'profile_built', false)).toBe(4);
    expect(scanStepIndex('done', 'profile_built', true)).toBe(5);
  });
});

describe('posting plan form', () => {
  const ok = {
    days: [1, 3],
    times: ['18:30', '10:00'],
    contentTypes: ['tips'],
    language: 'English',
    tone: '',
    notes: '',
    reviewFirst: false,
    accountIds: ['a1'],
  };
  it('builds the request body with sorted, unique times', () => {
    const out = planPayload({...ok, times: ['18:30', '10:00', '10:00']}, 3);
    expect('body' in out && (out.body.schedule as any).times).toEqual(['10:00', '18:30']);
    expect('body' in out && out.body.accountIds).toEqual(['a1']);
  });

  it.each([
    [{days: []}, /at least one posting day/],
    [{days: [1, 2, 3, 4]}, /allows 3 posting days/],
    [{times: []}, /Add a posting time/],
    [{times: ['25:00']}, /not a valid time/],
    [{times: ['10:00', '12:00', '18:00']}, /Up to 2 posts a day/],
    [{contentTypes: []}, /at least one kind/],
  ])('rejects %j', (over, message) => {
    const out = planPayload({...ok, ...over}, 3);
    expect('error' in out && out.error).toMatch(message);
  });

  it('says "day" not "days" for a one-day plan', () => {
    const out = planPayload({...ok, days: [1, 2]}, 1);
    expect('error' in out && out.error).toMatch(/allows 1 posting day a week/);
  });
});

describe('campaigns', () => {
  const one = [{id: 'c1'}];
  const two = [{id: 'c1'}, {id: 'c2'}];

  it('picks the campaign a screen works on', () => {
    expect(pickCampaign([], 'all', true)).toBeNull();
    expect(pickCampaign(one, null, true)).toBe('c1');
    expect(pickCampaign(one, 'all', true)).toBe('c1'); // "all" needs more than one campaign
    expect(pickCampaign(two, 'all', true)).toBe('all');
    expect(pickCampaign(two, null, true)).toBe('all');
    expect(pickCampaign(two, 'c2', true)).toBe('c2');
    expect(pickCampaign(two, 'gone', true)).toBe('all');
    expect(pickCampaign(two, 'all', false)).toBe('c1'); // Setup works on one campaign
  });

  it('knows which accounts another campaign already uses', () => {
    expect(accountTakenBy({campaign: null}, 'c1')).toBeNull();
    expect(accountTakenBy({}, 'c1')).toBeNull();
    expect(accountTakenBy({campaign: {id: 'c1', name: 'Bakery'}}, 'c1')).toBeNull();
    expect(accountTakenBy({campaign: {id: 'c2', name: 'Cafe'}}, 'c1')).toBe('Cafe');
  });

  it('builds and validates a competitor', () => {
    expect((competitorPayload('@Rival_One', ' cheap ') as any).body).toEqual({username: 'Rival_One', notes: 'cheap'});
    expect((competitorPayload('', 'a local chain') as any).body).toEqual({username: '', notes: 'a local chain'});
    expect((competitorPayload('', '  ') as any).error).toMatch(/username or a note/);
    expect((competitorPayload('not a handle!', '') as any).error).toMatch(/Instagram username/);
    expect((competitorPayload('rival_one', '', [{username: 'Rival_One'}]) as any).error).toMatch(/already added/);
    const five = Array.from({length: 5}, (_, i) => ({username: 'a' + i}));
    expect((competitorPayload('b', '', five) as any).error).toMatch(/up to 5/);
  });

  it('adds the scan steps for what the owner added, in the server order', () => {
    expect(scanSteps({intro: true, references: true, competitors: true}).map(s => s.key)).toEqual([
      'intro', 'profile', 'posts', 'references', 'competitors', 'style', 'profile_built',
    ]);
    expect(scanStepIndex('running', 'competitors', {references: true, competitors: true})).toBe(3);
    expect(scanStepIndex('running', 'style', {competitors: true})).toBe(3);
    expect(scanStepIndex('done', 'profile_built', {references: true})).toBe(5);
  });

  it('shows a campaign pill from its own switch and the shared plan state', () => {
    expect(campaignPill(false, {state: 'paid', endsAt: null}).text).toBe('Paused');
    expect(campaignPill(true, {state: 'paid', endsAt: null}).text).toBe('Live');
    expect(campaignPill(true, {state: 'expired', endsAt: null}).text).toBe('Needs a plan');
  });
});
