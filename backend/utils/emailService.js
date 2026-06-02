const nodemailer = require("nodemailer");

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function getPlanFeatures(plan) {
  const features = {
    starter: [
      "500 leads per month",
      "2 team members",
      "IndiaMART integration",
      "Follow-up reminders",
      "Email support",
    ],
    growth: [
      "5,000 leads per month",
      "10 team members",
      "IndiaMART + Facebook Lead Ads",
      "Visit calendar & scheduling",
      "Advanced follow-up workflows",
      "Priority support",
      "CSV export",
    ],
    enterprise: [
      "Unlimited leads",
      "Unlimited team members",
      "All integrations",
      "Custom workflows",
      "Dedicated account manager",
      "SLA guarantee",
      "Custom reporting",
      "API access",
    ],
  };
  return features[plan] || [];
}

function getPlanDisplayName(plan) {
  return { starter: "Starter", growth: "Growth", enterprise: "Enterprise" }[plan] || plan;
}

function formatAmount(amountInRupees) {
  return `₹${Number(amountInRupees).toLocaleString("en-IN")}`;
}

function buildWelcomeEmailHtml({ companyName, userName, plan, billingCycle, amount, paymentId, invoiceDate, dashboardUrl }) {
  const planName = getPlanDisplayName(plan);
  const features = getPlanFeatures(plan);
  const cycleLabel = billingCycle === "yearly" ? "Yearly" : "Monthly";
  const amountDisplay = formatAmount(amount);
  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;

  const featureRows = features
    .map(
      (f) => `
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#374151;">
          <span style="display:inline-block;width:20px;height:20px;background:#024BAB;border-radius:50%;text-align:center;line-height:20px;font-size:11px;color:#fff;margin-right:10px;vertical-align:middle;">✓</span>
          ${f}
        </td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to NESTLeads</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- ── HEADER BANNER ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#024BAB 0%,#0369a1 60%,#0c4a6e 100%);border-radius:16px 16px 0 0;padding:48px 40px 40px;text-align:center;">
              <!-- Logo mark -->
              <div style="display:inline-block;width:56px;height:56px;background:#fff;border-radius:14px;text-align:center;line-height:56px;font-size:28px;font-weight:900;color:#024BAB;margin-bottom:20px;letter-spacing:-1px;">N</div>
              <h1 style="margin:0 0 8px;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">NESTLeads</h1>
              <p style="margin:0;font-size:15px;color:#bfdbfe;letter-spacing:0.5px;">Lead Management Platform</p>

              <!-- Confetti bar -->
              <div style="margin-top:28px;font-size:28px;letter-spacing:4px;">🎉 🚀 ✨ 🎊</div>
            </td>
          </tr>

          <!-- ── WELCOME BODY ── -->
          <tr>
            <td style="background:#ffffff;padding:40px;">

              <h2 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#111827;">
                Welcome aboard, ${companyName}! 🎉
              </h2>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
                Hi ${userName}, your payment was successful and your <strong style="color:#024BAB;">${planName} Plan</strong> is now active.
                Your sales pipeline is ready — let's grow together.
              </p>

              <!-- Plan badge -->
              <div style="background:#eff6ff;border:2px solid #024BAB;border-radius:12px;padding:20px 24px;margin-bottom:28px;text-align:center;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#024BAB;text-transform:uppercase;letter-spacing:1px;">Active Plan</p>
                <p style="margin:0;font-size:28px;font-weight:800;color:#111827;">${planName}</p>
                <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${cycleLabel} Subscription</p>
              </div>

              <!-- Features -->
              <h3 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111827;">What's included in your plan:</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                ${featureRows}
              </table>

              <!-- CTA button -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${dashboardUrl}" style="display:inline-block;background:#024BAB;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 40px;border-radius:10px;letter-spacing:0.3px;">
                  Go to Dashboard →
                </a>
              </div>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 28px;" />

              <!-- Invoice details -->
              <h3 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#111827;">Invoice & Payment Details</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;overflow:hidden;">
                <tr style="border-bottom:1px solid #e5e7eb;">
                  <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:500;">Invoice Number</td>
                  <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:600;text-align:right;">${invoiceNumber}</td>
                </tr>
                <tr style="border-bottom:1px solid #e5e7eb;">
                  <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:500;">Plan</td>
                  <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:600;text-align:right;">${planName} (${cycleLabel})</td>
                </tr>
                <tr style="border-bottom:1px solid #e5e7eb;">
                  <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:500;">Amount Paid</td>
                  <td style="padding:12px 16px;font-size:14px;color:#024BAB;font-weight:700;text-align:right;">${amountDisplay}</td>
                </tr>
                <tr style="border-bottom:1px solid #e5e7eb;">
                  <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:500;">Payment ID</td>
                  <td style="padding:12px 16px;font-size:12px;color:#374151;font-weight:500;text-align:right;font-family:monospace;">${paymentId}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:500;">Date</td>
                  <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:600;text-align:right;">${invoiceDate}</td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="background:#1e293b;border-radius:0 0 16px 16px;padding:28px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#ffffff;">NESTLeads by Pixelate Nest</p>
              <p style="margin:0 0 16px;font-size:13px;color:#94a3b8;line-height:1.6;">
                Need help getting started? Reply to this email or reach out to our support team.
              </p>
              <p style="margin:0;font-size:12px;color:#64748b;">
                © ${new Date().getFullYear()} Pixelate Nest. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

async function sendWelcomeEmail({ to, companyName, userName, plan, billingCycle, amount, paymentId }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("Email not configured — skipping welcome email.");
    return;
  }

  const transporter = createTransport();
  const dashboardUrl = process.env.CLIENT_URL || "https://leads.pixelatenest.com";
  const invoiceDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const html = buildWelcomeEmailHtml({
    companyName,
    userName,
    plan,
    billingCycle,
    amount,
    paymentId,
    invoiceDate,
    dashboardUrl,
  });

  await transporter.sendMail({
    from: `"NESTLeads" <${process.env.SMTP_USER}>`,
    to,
    subject: `Welcome to NESTLeads — Your ${getPlanDisplayName(plan)} Plan is Active 🎉`,
    html,
  });
}

module.exports = { sendWelcomeEmail };
