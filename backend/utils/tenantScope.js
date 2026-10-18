// Filter that pins a query to the caller's tenant. Used for every single-record lookup by :id so one
// tenant can never read/modify another tenant's data (the id alone is not an authorisation).
const tenantScope = (req) => (req.user && req.user.tenantId ? { tenantId: req.user.tenantId } : {});

// Fields a client must never be able to set through a request body.
const PROTECTED = ["_id", "tenantId", "deletedAt", "deletedBy", "createdBy", "__v"];
const safeBody = (body = {}) => {
  const out = { ...body };
  for (const k of PROTECTED) delete out[k];
  return out;
};

module.exports = { tenantScope, safeBody };
