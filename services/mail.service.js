const nodemailer = require('nodemailer');

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let cachedTransporter = null;

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return null;
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: { user, pass },
    });
  }
  return cachedTransporter;
}

const sendApprovalEmail = async (toEmail, userName) => {
  const transporter = getTransporter();
  if (!transporter) {
    // eslint-disable-next-line no-console
    console.warn('Mail: EMAIL_USER / EMAIL_PASS not set; skipping approval email.');
    return { skipped: true };
  }
  if (!toEmail || !String(toEmail).trim()) {
    // eslint-disable-next-line no-console
    console.warn('Mail: no recipient email; skipping approval email.');
    return { skipped: true };
  }

  const safeName = escapeHtml(userName);

  const mailOptions = {
    from: `"Myanmar Space Agency Library" <${process.env.EMAIL_USER}>`,
    to: String(toEmail).trim(),
    subject: '🎉 Registration Approved - Welcome!',
    html: `
      <div style="font-family: Arial; padding: 20px;">
        <h2 style="color:#4CAF50;">Welcome, ${safeName} 🎉</h2>
        <p>We confirmed your registration successfully.</p>

        <p>Your account is now <b>approved</b> and you can start using the system.</p>

        <ul>
          <li>📚 Browse books</li>
          <li>📖 Read e-books</li>
          <li>⭐ Save favorites</li>
        </ul>

        <p style="margin-top:20px;">
          Start exploring now and enjoy your learning journey 🚀
        </p>

        <hr/>
        <small>This is an automated email. Please do not reply.</small>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendApprovalEmail };
