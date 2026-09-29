// node scripts/check-wa-vault.js — no DB, no network.
const assert = require("assert");
const { buildTemplateComponents, checkHeaderFits } = require("../controllers/whatsappController")._test;

const lead = { name: "Asha", company: "ABC" };
const map = [{ position: 1, fieldKey: "name" }];
const pdf = { mimeType: "application/pdf" };
const jpg = { mimeType: "image/jpeg" };

// Vault doc replaces the template's saved header file.
const docTpl = { headerType: "DOCUMENT", headerMediaId: "old", headerMediaName: "old.pdf" };
const c = buildTemplateComponents(docTpl, map, lead, { id: "new", filename: "Brochure.pdf" });
assert.deepStrictEqual(c[0].parameters[0], { type: "document", document: { id: "new", filename: "Brochure.pdf" } });
assert.strictEqual(c[1].parameters[0].text, "Asha");

// No override → saved header kept.
assert.strictEqual(buildTemplateComponents(docTpl, map, lead)[0].parameters[0].document.id, "old");

// Image header takes only the id.
const img = buildTemplateComponents({ headerType: "IMAGE" }, [], lead, { id: "i1", filename: "x.jpg" });
assert.deepStrictEqual(img[0].parameters[0], { type: "image", image: { id: "i1" } });

// Fit rules.
assert.strictEqual(checkHeaderFits(docTpl, pdf), null);
assert.strictEqual(checkHeaderFits(docTpl, jpg), null);
assert.ok(checkHeaderFits({ headerType: "TEXT" }, pdf));
assert.ok(checkHeaderFits({ headerType: "IMAGE" }, pdf));
assert.strictEqual(checkHeaderFits({ headerType: "IMAGE" }, jpg), null);

console.log("check-wa-vault: ok");
