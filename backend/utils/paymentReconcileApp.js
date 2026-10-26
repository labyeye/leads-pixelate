const Subscription = require("../models/Subscription");

// What is specific to this product: which orders are ours, and how a paid order becomes a subscription.
module.exports = {
  ownsOrder: async (orderId) => !!(await Subscription.exists({ "pendingOrder.razorpayOrderId": orderId })),
  alreadyProvisioned: async (paymentId) => !!(await Subscription.exists({ "invoices.razorpayPaymentId": paymentId })),
  provision: (ev) => require("../routes/billingRoutes").provisionRazorpay(ev),
};
