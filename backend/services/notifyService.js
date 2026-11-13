const Notification = require("../models/Notification");
const User = require("../models/User");
const { pushToUsers } = require("./pushService");
const log = require("../utils/logger").scope("Notify");

/**
 * Saves an inbox row for each user and sends a push on top.
 * Fire-and-forget: never throws and never needs awaiting, so it can't slow down or fail a request.
 * payload: { tenantId, type, title, body?, data? }  (data.screen / data.id say where a tap goes)
 */
function notify(userIds, payload) {
  (async () => {
    const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
    if (!ids.length || !payload?.type || !payload?.title) return;
    const { tenantId = null, type, title, body = "", data = {} } = payload;
    await Notification.insertMany(
      ids.map((user) => ({ user, tenantId, type, title, body, data })),
      { ordered: false },
    );
    await pushToUsers(ids, { title, body, data: { type, ...data } });
  })().catch((e) => log.error("notify failed", { message: e.message }));
}

/** Everyone who runs the account (admins + super admins), minus whoever caused the event. */
function notifyAdmins(tenantId, payload, exceptUserId) {
  (async () => {
    const users = await User.find({
      ...(tenantId ? { tenantId } : {}),
      role: { $in: ["super_admin", "admin"] },
      status: { $ne: "inactive" },
    }).select("_id");
    notify(
      users.map((u) => u._id).filter((id) => String(id) !== String(exceptUserId || "")),
      { tenantId, ...payload },
    );
  })().catch((e) => log.error("notifyAdmins failed", { message: e.message }));
}

module.exports = { notify, notifyAdmins };
