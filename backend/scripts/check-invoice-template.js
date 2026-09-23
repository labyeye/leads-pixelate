// Offline check of the Invoice Designer template validation (no database).
const assert = require("assert");
const { sanitizeInvoiceTemplate } = require("../utils/invoiceTemplate");

const PX = "data:image/png;base64,iVBORw0KGgo=";
const ok = sanitizeInvoiceTemplate({
  theme: { primary: "#ff0000", font: "Comic", scale: 9, borders: "lines" },
  blocks: [
    { id: "a", type: "title", props: { text: "Hi", align: "middle", evil: "<script>" } },
    { type: "nope" },
    { type: "note", props: { size: 500, color: "red", fill: "#00ff00" } },
    { type: "image", props: { src: PX } },
  ],
  floats: [{ kind: "image", src: PX, x: -5, y: 500, opacity: 0 }, { kind: "text", text: "x", color: "javascript:1" }, { kind: "video" }],
});
assert.strictEqual(ok.theme.primary, "#ff0000");
assert.strictEqual(ok.theme.font, "Helvetica"); // unknown font -> default
assert.strictEqual(ok.theme.scale, 1.3); // clamped
assert.strictEqual(ok.blocks.length, 3); // unknown type dropped
assert.deepStrictEqual(ok.blocks[0].props, { text: "Hi" }); // bad enum + unknown key dropped
assert.strictEqual(ok.blocks[1].props.size, 30);
assert.strictEqual(ok.blocks[1].props.color, ""); // not a hex colour
assert.strictEqual(ok.floats.length, 2);
assert.deepStrictEqual([ok.floats[0].x, ok.floats[0].y, ok.floats[0].opacity], [0, 100, 0.05]);
assert.strictEqual(ok.floats[1].color, "#111111");

// images inside sections: logo override + signature size survive, sizes are clamped
const sec = sanitizeInvoiceTemplate({ blocks: [{ type: "header", props: { logoSrc: PX, logoHeight: 9999 } }, { type: "footer", props: { signatureSrc: PX, signatureWidth: 5 } }] });
assert.strictEqual(sec.blocks[0].props.logoSrc, PX);
assert.strictEqual(sec.blocks[0].props.logoHeight, 200);
assert.strictEqual(sec.blocks[1].props.signatureWidth, 30);
assert.throws(() => sanitizeInvoiceTemplate(null), /Invalid/);
assert.throws(() => sanitizeInvoiceTemplate({ blocks: [{ type: "image", props: { src: "https://evil.example/x.png" } }] }), /PNG or JPEG/);
assert.throws(() => sanitizeInvoiceTemplate({ blocks: [{ type: "image", props: { src: "data:image/png;base64," + "A".repeat(600001) } }] }), /too large/);
assert.throws(() => sanitizeInvoiceTemplate({ blocks: Array(41).fill({ type: "spacer" }) }), /At most 40/);
console.log("check-invoice-template: all checks passed");
