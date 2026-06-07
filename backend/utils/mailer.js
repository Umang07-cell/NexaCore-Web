const nodemailer = require('nodemailer');

// ── Single shared transporter (reused across calls, avoids reconnection delays)
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    // Connection pool — avoids re-establishing SMTP handshake on every email
    pool:           true,
    maxConnections: 3,
    maxMessages:    100,
    // Increase timeouts so slow SMTP servers don't drop the first attempt
    connectionTimeout: 10000,   // 10 s
    greetingTimeout:   10000,
    socketTimeout:     15000
  });
  return _transporter;
}

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Send an email with up to 2 retries on transient failures.
 */
async function sendWithRetry(mailOptions, retries = 2) {
  const transporter = getTransporter();
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      return; // success
    } catch (err) {
      const isTransient = err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT' ||
                          err.responseCode >= 420;
      if (isTransient && attempt <= retries) {
        // Brief back-off before retry
        await new Promise(r => setTimeout(r, 800 * attempt));
        // Reset transporter on connection errors so pool reconnects
        if (err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT') {
          try { _transporter.close(); } catch (_) {}
          _transporter = null;
        }
      } else {
        throw err; // Non-transient or out of retries
      }
    }
  }
}

/**
 * Send OTP email for registration verification.
 */
async function sendOTPEmail(toEmail, toName, otp) {
  if (!hasSmtpConfig()) {
    console.log(`\n📧  [DEV] OTP for ${toEmail}: ${otp}\n`);
    return { devMode: true, otp };
  }

  await sendWithRetry({
    from:    process.env.MAIL_FROM || process.env.SMTP_USER,
    to:      toEmail,
    subject: 'Your NexaCore Verification Code',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:12px;">
        <h2 style="color:#0c1b33;margin-bottom:4px;">NexaCore<span style="color:#0ea5e9;">.</span></h2>
        <h3 style="color:#0c1b33;">Verify your email address</h3>
        <p style="color:#64748b;">Hi ${toName}, use the code below to complete your registration.</p>
        <div style="background:#0c1b33;border-radius:10px;padding:28px;text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#0ea5e9;">${otp}</span>
        </div>
        <p style="color:#64748b;font-size:13px;">This code expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.<br/>If you didn't create an account, ignore this email.</p>
      </div>
    `
  });
  return { devMode: false };
}

/**
 * Send contact form notification to the NexaCore team.
 */
async function sendContactEmail({ name, email, subject, message }) {
  if (!hasSmtpConfig()) {
    console.log(`\n📧  [DEV] Contact from ${name} <${email}>: ${subject}\n`);
    return;
  }
  const dest = process.env.CONTACT_TO || process.env.SMTP_USER;
  await sendWithRetry({
    from:    process.env.MAIL_FROM || process.env.SMTP_USER,
    to:      dest,
    replyTo: email,
    subject: `NexaCore Contact: ${subject}`,
    text:    `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`
  });
}

module.exports = { sendOTPEmail, sendContactEmail, hasSmtpConfig };
