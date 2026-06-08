const https = require("https");

const PINCODE_RE = /^\d{6}$/;

function isPincode(val) {
  return typeof val === "string" && PINCODE_RE.test(val.trim());
}

function lookupPincode(pin) {
  return new Promise((resolve) => {
    const url = `https://api.postalpincode.in/pincode/${pin}`;
    https
      .get(url, (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            const data = JSON.parse(raw);
            const record = data?.[0];
            if (record?.Status !== "Success") return resolve(null);
            const po = record.PostOffice?.[0];
            if (!po) return resolve(null);
            resolve({
              city: po.District || po.Name,
              state: po.State,
            });
          } catch {
            resolve(null);
          }
        });
      })
      .on("error", () => resolve(null));
  });
}

async function resolvePincode(val) {
  if (!val || !isPincode(val)) return null;
  return lookupPincode(val.trim());
}

module.exports = { isPincode, resolvePincode };
