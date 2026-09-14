const ActivityLog = require("../models/ActivityLog");
const log = require("./logger").scope("Activity Log");

function logActivity({ user, action, module, description, targetId, ip } = {}) {
  (async () => {
    try {
      await ActivityLog.create({
        user: user?._id || null,
        userName: user?.name || "Anonymous",
        userEmail: user?.email || "",
        userRole: user?.role || "",
        tenantId: user?.tenantId || null,
        action,
        module,
        description,
        targetId: targetId ? String(targetId) : undefined,
        ip,
        timestamp: new Date(),
      });
    } catch (err) {
      log.error("Failed to write activity log", { action, message: err.message });
    }
  })();
}

module.exports = logActivity;
