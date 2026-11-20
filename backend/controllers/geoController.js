const asyncHandler = require("express-async-handler");
const Lead = require("../models/Lead");
const { stateOf, countryOf } = require("../utils/geoNormalize");

// Where leads come from and where they convert: Indian states and countries.
// ?from=&to= (ISO) limits to leads created in that range.
const getGeoStats = asyncHandler(async (req, res) => {
  const match = { deletedAt: null };
  if (req.user.tenantId) match.tenantId = req.user.tenantId;
  const from = new Date(req.query.from || "");
  const to = new Date(req.query.to || "");
  if (!isNaN(from) || !isNaN(to)) {
    match.createdAt = {};
    if (!isNaN(from)) match.createdAt.$gte = from;
    if (!isNaN(to)) match.createdAt.$lte = to;
  }
  const won = { $sum: { $cond: [{ $eq: ["$status", "WON"] }, 1, 0] } };

  // Group on the raw text first (a few hundred variants), then clean up in JS.
  const [stateRows, phoneRows, cityRows] = await Promise.all([
    Lead.aggregate([
      { $match: match },
      { $group: { _id: { s: "$state", l: "$location" }, n: { $sum: 1 }, won } },
    ]),
    Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            p: { $substrCP: [{ $ifNull: ["$phone", ""] }, 0, 5] },
            len: { $strLenCP: { $ifNull: ["$phone", ""] } },
          },
          n: { $sum: 1 },
          won,
        },
      },
    ]),
    Lead.aggregate([
      { $match: { ...match, location: { $nin: [null, ""] } } },
      { $group: { _id: { $toLower: { $trim: { input: "$location" } } }, n: { $sum: 1 }, won } },
      { $sort: { n: -1 } },
      { $limit: 200 },
    ]),
  ]);

  const add = (map, name, r) => {
    const cur = map.get(name) || { name, leads: 0, won: 0 };
    cur.leads += r.n;
    cur.won += r.won;
    map.set(name, cur);
  };
  const finish = (map) =>
    [...map.values()]
      .map((r) => ({ ...r, rate: r.leads ? Math.round((r.won / r.leads) * 1000) / 10 : 0 }))
      .sort((a, b) => b.leads - a.leads);

  const states = new Map();
  let unknownState = 0;
  for (const r of stateRows) {
    const s = stateOf(r._id.s, r._id.l);
    if (s) add(states, s, r);
    else unknownState += r.n;
  }

  const countries = new Map();
  let unknownCountry = 0;
  for (const r of phoneRows) {
    // Rebuild a phone-like sample long enough for countryOf's length checks.
    const sample = r._id.p + "0".repeat(Math.max(0, r._id.len - r._id.p.length));
    const c = countryOf(sample);
    if (c) add(countries, c, r);
    else unknownCountry += r.n;
  }

  const cities = new Map();
  for (const r of cityRows) {
    const name = r._id.replace(/\b\w/g, (c) => c.toUpperCase());
    add(cities, name, r);
  }

  const total = stateRows.reduce((a, r) => a + r.n, 0);
  res.json({
    success: true,
    data: {
      total,
      states: finish(states),
      countries: finish(countries),
      cities: finish(cities).slice(0, 15),
      unknownState,
      unknownCountry,
    },
  });
});

module.exports = { getGeoStats };
