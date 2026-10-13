// node scripts/check-wa-tenants.js kalahanutechstudios@gmail.com skylyf21@gmail.com
// Compares the saved WhatsApp setup of the given users' tenants and asks Meta what
// each stored token / WABA / number actually looks like. Prints NO secrets.
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const { decrypt } = require("../utils/encryption");

const G = "https://graph.facebook.com/v21.0";
const get = async (path, token) => {
  try {
    const r = await fetch(`${G}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`);
    return await r.json();
  } catch (e) {
    return { error: { message: e.message } };
  }
};
const short = (e) => (e ? `ERROR ${e.code ?? ""}${e.error_subcode ? "/" + e.error_subcode : ""}: ${e.message}` : null);

(async () => {
  const emails = process.argv.slice(2);
  if (!emails.length) {
    console.log("usage: node scripts/check-wa-tenants.js <email> [<email> ...]");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);

  for (const email of emails) {
    console.log("\n==============================", email);
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) { console.log("user not found"); continue; }
    console.log("role:", user.role, "| status:", user.status, "| tenantId:", String(user.tenantId || "-"));

    const tenant = await Tenant.findOne(user.tenantId ? { _id: user.tenantId } : { ownerUser: user._id });
    if (!tenant) { console.log("tenant not found"); continue; }
    const wa = tenant.integrations?.whatsapp || {};
    console.log("tenant:", tenant.name, "| plan:", tenant.plan, "| status:", tenant.status);
    console.log("wa.isConnected:", !!wa.isConnected, "| enabled:", !!wa.enabled, "| wabaId:", wa.wabaId || "(empty)");
    console.log("wa.lastSyncAt:", wa.lastSyncAt || "-", "| token saved:", !!wa.accessToken);
    console.log("phoneNumbers:", (wa.phoneNumbers || []).map((p) => `${p.phoneNumberId} (${p.phoneNumber || p.displayPhoneNumber || p.label || "?"})`));

    if (!wa.accessToken) { console.log("-> no token saved"); continue; }
    let token;
    try { token = decrypt(wa.accessToken); } catch (e) { console.log("-> cannot decrypt token:", e.message); continue; }

    const dbg = await get(`/debug_token?input_token=${encodeURIComponent(token)}`, token);
    if (dbg.error) console.log("debug_token:", short(dbg.error));
    else {
      const d = dbg.data || {};
      console.log("token:", { type: d.type, app: d.application, is_valid: d.is_valid,
        expires_at: d.expires_at ? new Date(d.expires_at * 1000).toISOString() : "never", scopes: d.scopes });
    }

    if (wa.wabaId) {
      const w = await get(`/${wa.wabaId}?fields=name,currency,account_review_status,business_verification_status`, token);
      console.log("WABA:", w.error ? short(w.error) : w);
      const s = await get(`/${wa.wabaId}/subscribed_apps`, token);
      console.log("subscribed_apps:", s.error ? short(s.error) : (s.data || []).map((x) => x.whatsapp_business_api_data?.name || x));
    }
    for (const p of wa.phoneNumbers || []) {
      const n = await get(`/${p.phoneNumberId}?fields=display_phone_number,verified_name,status,code_verification_status,platform_type,account_mode,quality_rating,webhook_configuration`, token);
      console.log(`number ${p.phoneNumberId}:`, n.error ? short(n.error) : n);
    }
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
