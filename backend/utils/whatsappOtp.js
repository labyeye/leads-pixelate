const log = require("./logger").scope("WhatsApp OTP");

const WA_API = "https://graph.facebook.com/v20.0";

// 919876543210 -> 9198****3210 (never log full numbers, tokens or codes)
const maskPhone = (p) => {
  const d = String(p || "").replace(/\D/g, "");
  return d.length > 6 ? `${d.slice(0, 4)}****${d.slice(-4)}` : "****";
};

// Sends a one-time code via the platform's own WhatsApp Business number
// (not a tenant's connected number — this is for NestLeads' own users,
// e.g. password reset), using a pre-approved AUTHENTICATION template.
async function sendWhatsAppOtp(phone, code) {
  const accessToken = process.env.WHATSAPP_PLATFORM_ACCESS_TOKEN || process.env.META_WA_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PLATFORM_PHONE_NUMBER_ID || process.env.META_WA_PHONE_ID;
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME || "nest_otp";
  const languageCode = process.env.WHATSAPP_OTP_TEMPLATE_LANG || "en";
  const hasCopyCodeButton = process.env.WHATSAPP_OTP_HAS_BUTTON !== "false";

  if (!accessToken || !phoneNumberId) {
    log.error("Not configured — cannot send OTP", {
      hasToken: !!accessToken,
      hasPhoneNumberId: !!phoneNumberId,
      hint: "set META_WA_TOKEN and META_WA_PHONE_ID (or WHATSAPP_PLATFORM_*)",
    });
    throw new Error("WhatsApp platform number is not configured");
  }

  log.info("Sending OTP", {
    to: maskPhone(phone),
    template: templateName,
    lang: languageCode,
    button: hasCopyCodeButton,
    phoneNumberId,
  });

  const components = [
    { type: "body", parameters: [{ type: "text", text: code }] },
  ];
  if (hasCopyCodeButton) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: code }],
    });
  }

  const startedAt = Date.now();
  let res;
  try {
    res = await fetch(`${WA_API}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    }),
    });
  } catch (err) {
    log.error("Network error calling Meta API", {
      to: maskPhone(phone),
      message: err.message,
    });
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  const ms = Date.now() - startedAt;
  if (!res.ok) {
    const e = data?.error || {};
    log.error("Meta rejected the OTP message", {
      to: maskPhone(phone),
      httpStatus: res.status,
      code: e.code,
      subcode: e.error_subcode,
      type: e.type,
      message: e.message,
      details: e.error_data?.details,
      ms,
      hint:
        e.code === 190
          ? "access token invalid/expired — generate a new system-user token"
          : e.code === 132001
            ? "template not found — check WHATSAPP_OTP_TEMPLATE_NAME and WHATSAPP_OTP_TEMPLATE_LANG"
            : e.code === 132000 || e.code === 132012
              ? "template parameters don't match — check WHATSAPP_OTP_HAS_BUTTON"
              : e.code === 131030
                ? "recipient number not allowed (test mode: add it to the allowed list)"
                : undefined,
    });
    throw new Error(e.message || "WhatsApp API error");
  }
  log.info("OTP accepted by Meta", {
    to: maskPhone(phone),
    messageId: data?.messages?.[0]?.id,
    waId: data?.contacts?.[0]?.wa_id,
    ms,
  });
  return data;
}

module.exports = { sendWhatsAppOtp };
