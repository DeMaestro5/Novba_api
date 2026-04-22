const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

const recipients = [
  { email: 'jayjones298@gmail.com', name: 'Jay' },
  { email: 'joyisaac1992@gmail.com', name: 'Joy' },
  { email: 'bandungxoxo@gmail.com', name: 'there' },
  { email: 'kevalkanpariya01@gmail.com', name: 'Keval' },
  { email: 'osstephen70@gmail.com', name: 'Stephen' },
];

async function sendLaunchEmails() {
  for (const person of recipients) {
    try {
      await resend.emails.send({
        from: 'Stephen from Novba <stephen@usenovba.com>',
        to: person.email,
        subject: "Novba is live — your access is ready",
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">

    <!-- Logo -->
    <div style="margin-bottom:32px;">
      <span style="font-size:24px;font-weight:900;color:#111827;">nov</span><span style="font-size:24px;font-weight:900;color:#ea580c;">ba</span>
    </div>

    <!-- Card -->
    <div style="background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;padding:40px;">

      <p style="margin:0 0 24px 0;font-size:16px;color:#374151;">Hi ${person.name},</p>

      <p style="margin:0 0 16px 0;font-size:15px;color:#374151;">You signed up for early access to Novba months ago.</p>

      <p style="margin:0 0 28px 0;font-size:18px;font-weight:800;color:#111827;">Today, it's finally ready.</p>

      <p style="margin:0 0 16px 0;font-size:15px;color:#374151;">Novba is now live at <a href="https://www.usenovba.com" style="color:#ea580c;font-weight:600;text-decoration:none;">usenovba.com</a> — and you're one of the first people to use it.</p>

      <!-- What you can do -->
      <div style="background:#f9fafb;border-radius:12px;padding:24px;margin:24px 0;">
        <p style="margin:0 0 16px 0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">What you can do right now</p>
        <table style="width:100%;border-collapse:collapse;">
          ${[
            'Create and send professional invoices in under 60 seconds',
            'Manage clients with payment tracking and history',
            'Build proposals and contracts with built-in templates',
            'Track projects, payments, and expenses in one place',
            'Use the AI Rate Analyzer to see if you\'re undercharging',
            'Get market-aligned project estimates with the AI Project Estimator',
          ].map(item => `
          <tr>
            <td style="padding:6px 0;width:24px;vertical-align:top;">
              <span style="color:#16a34a;font-size:15px;">✓</span>
            </td>
            <td style="padding:6px 0;font-size:14px;color:#374151;">${item}</td>
          </tr>`).join('')}
        </table>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="https://www.usenovba.com/signup" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:12px;font-weight:700;font-size:16px;">
          Get Started Now →
        </a>
        <p style="margin:12px 0 0 0;font-size:12px;color:#9ca3af;">Your account is ready — just sign up with this email and you're in</p>
      </div>

      <!-- Notes -->
      <div style="border-top:1px solid #f3f4f6;padding-top:24px;margin-top:8px;">
        <p style="margin:0 0 12px 0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">A few things to know</p>
        <p style="margin:0 0 8px 0;font-size:14px;color:#374151;">→ This is the first public version — real, working software but we're still shipping features</p>
        <p style="margin:0 0 8px 0;font-size:14px;color:#374151;">→ AI Pricing Insights (personalized analysis from your invoice data) is coming in the next update</p>
        <p style="margin:0 0 0 0;font-size:14px;color:#374151;">→ Your feedback will directly shape what gets built next</p>
      </div>

      <!-- Personal note -->
      <div style="background:linear-gradient(135deg,#fff7ed,#fef3c7);border:1px solid #fed7aa;border-radius:12px;padding:20px;margin:24px 0;">
        <p style="margin:0 0 12px 0;font-size:14px;color:#92400e;line-height:1.6;">I've been building this solo for months. Every line of code. Every design decision. Every feature. The goal: help freelancers like you get paid faster, charge what you're worth, and spend less time on admin work.</p>
        <p style="margin:0;font-size:14px;color:#92400e;">If something breaks or feels off, just reply to this email. I read and respond to everything.</p>
      </div>

      <p style="margin:0 0 4px 0;font-size:15px;color:#374151;">Thanks for believing in this from the beginning.</p>
      <p style="margin:0 0 24px 0;font-size:15px;font-weight:700;color:#111827;">Now go create your first invoice 🚀</p>

      <p style="margin:0 0 4px 0;font-size:14px;color:#374151;">— Stephen</p>
      <p style="margin:0;font-size:14px;color:#6b7280;">Founder, <a href="https://www.usenovba.com" style="color:#ea580c;text-decoration:none;font-weight:600;">Novba</a></p>
    </div>

    <!-- PS -->
    <div style="margin-top:24px;padding:16px 20px;background:#fff7ed;border-radius:12px;border:1px solid #fed7aa;">
      <p style="margin:0;font-size:13px;color:#92400e;"><strong>P.S.</strong> You're getting lifetime free access because you were one of the first to sign up. That access is locked in forever.</p>
    </div>

    <!-- Footer -->
    <div style="margin-top:24px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        © 2026 Novba · <a href="https://www.usenovba.com" style="color:#9ca3af;text-decoration:none;">usenovba.com</a>
      </p>
    </div>

  </div>
</body>
</html>
        `,
      });

      console.log(`✅ Sent to ${person.email}`);
      // Small delay between sends to be safe
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (err) {
      console.error(`❌ Failed to send to ${person.email}:`, err.message);
    }
  }

  console.log('\nDone! All launch emails processed.');
}

sendLaunchEmails();
