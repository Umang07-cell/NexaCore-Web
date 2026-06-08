const https = require('https');
 
function hasBrevoConfig() {
  return Boolean(process.env.BREVO_API_KEY);
}
 
function sendBrevoEmail({ to, toName, subject, html, text }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      sender: { name: 'NexaCore', email: process.env.MAIL_FROM || 'aatharvkale60@gmail.com' },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent: html,
      textContent: text
    });
 
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      }
    };
 
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`Brevo API error ${res.statusCode}: ${data}`));
      });
    });
 
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
 
// ── OTP Email ─────────────────────────────────────────────────────────────────
async function sendOTPEmail(toEmail, toName, otp) {
  if (!hasBrevoConfig()) {
    console.log(`\n📧  [DEV] OTP for ${toEmail}: ${otp}\n`);
    return { devMode: true, otp };
  }
 
  await sendBrevoEmail({
    to: toEmail,
    toName,
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
 
// ── Contact Email ─────────────────────────────────────────────────────────────
async function sendContactEmail({ name, email, subject, message }) {
  if (!hasBrevoConfig()) {
    console.log(`\n📧  [DEV] Contact from ${name} <${email}>: ${subject}\n`);
    return;
  }
  const dest = process.env.CONTACT_TO || process.env.ADMIN_EMAIL;
  await sendBrevoEmail({
    to: dest,
    toName: 'NexaCore Team',
    subject: `NexaCore Contact: ${subject}`,
    text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`
  });
}
 
// ── Admin Notification ────────────────────────────────────────────────────────
async function sendAdminNotification({ subject, text }) {
  if (!hasBrevoConfig() || !process.env.ADMIN_EMAIL) return;
  await sendBrevoEmail({
    to: process.env.ADMIN_EMAIL,
    toName: 'NexaCore Admin',
    subject,
    text
  });
}
 
// ── New Service Request Notification ─────────────────────────────────────────
async function sendNewServiceNotification({ userName, userEmail, serviceId }) {
  await sendAdminNotification({
    subject: `New Service Request: ${serviceId}`,
    text: `${userName} (${userEmail}) has requested the "${serviceId}" service.\n\nLog in to the admin dashboard to review and accept or cancel.`
  });
}
 
// ── New Team Connect Notification ─────────────────────────────────────────────
async function sendNewTeamConnectNotification({ userName, userEmail, department, message }) {
  await sendAdminNotification({
    subject: `New Team Connect Request from ${userName}`,
    text: `${userName} (${userEmail}) submitted a team connect request.\n\nDepartment: ${department}\nMessage: ${message}\n\nLog in to the admin dashboard to respond.`
  });
}
 
// ── Admin Reply to User ───────────────────────────────────────────────────────
async function sendAdminReply({ toEmail, toName, message, department }) {
  if (!hasBrevoConfig()) {
    console.log(`\n📧  [DEV] Admin reply to ${toEmail}: ${message}\n`);
    return;
  }
  await sendBrevoEmail({
    to: toEmail,
    toName,
    subject: `Response from NexaCore ${department} Team`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:12px;">
        <h2 style="color:#0c1b33;margin-bottom:4px;">NexaCore<span style="color:#0ea5e9;">.</span></h2>
        <h3 style="color:#0c1b33;">Response from our ${department} team</h3>
        <p style="color:#64748b;">Hi ${toName},</p>
        <div style="background:#fff;border-left:4px solid #0ea5e9;padding:16px 20px;margin:20px 0;border-radius:4px;">
          <p style="color:#0c1b33;margin:0;">${message}</p>
        </div>
        <p style="color:#64748b;font-size:13px;">If you have further questions, feel free to reach out again.</p>
      </div>
    `
  });
}
 
function hasSmtpConfig() { return hasBrevoConfig(); }
 
module.exports = {
  sendOTPEmail,
  sendContactEmail,
  sendAdminNotification,
  sendNewServiceNotification,
  sendNewTeamConnectNotification,
  sendAdminReply,
  hasSmtpConfig
};
