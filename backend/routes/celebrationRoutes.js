const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect } = require("../middleware/auth");

// Today's (IST) birthdays + wedding anniversaries of this tenant's TEAM (users incl. owner). Leads/contacts are never included.
router.get("/", protect, async (req, res, next) => {
  try {
    const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
    const m = ist.getUTCMonth();
    const d = ist.getUTCDate();
    const y = ist.getUTCFullYear();
    const on = (dt) => dt && new Date(dt).getUTCMonth() === m && new Date(dt).getUTCDate() === d;
    const q = { status: "active" };
    if (req.user.tenantId) q.tenantId = req.user.tenantId;
    const team = await User.find(q).select("name avatar dateOfBirth marriageAnniversary").lean();
    const data = [];
    for (const u of team) {
      const base = { name: u.name, avatar: u.avatar };
      if (on(u.dateOfBirth)) data.push({ ...base, id: `b-${u._id}`, kind: "birthday", detail: "Birthday today" });
      const yrs = u.marriageAnniversary ? y - new Date(u.marriageAnniversary).getUTCFullYear() : 0;
      if (on(u.marriageAnniversary))
        data.push({ ...base, id: `a-${u._id}`, kind: "anniversary", detail: yrs >= 1 ? `Wedding anniversary · ${yrs} year${yrs === 1 ? "" : "s"}` : "Wedding anniversary" });
    }
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
