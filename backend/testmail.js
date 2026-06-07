require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

transporter.sendMail({
  from: process.env.SMTP_USER,
  to: process.env.SMTP_USER,
  subject: 'NexaCore Test',
  text: 'If you see this, email is working!'
}).then(() => {
  console.log('✅ Email sent successfully!');
}).catch(err => {
  console.error('❌ Error:', err.message);
});