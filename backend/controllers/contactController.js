const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  email:     { type: String, required: true },
  message:   { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const ContactMessage = mongoose.models.ContactMessage
  || mongoose.model('ContactMessage', ContactSchema);

exports.submitContact = async (req, res) => {
  try {
    const { name, email, message, caseDetails } = req.body;
    const bodyText = (message || caseDetails || '').trim();

    if (!name?.trim() || !email?.trim() || !bodyText) {
      return res.status(400).json({
        success: false,
        message: 'All fields required: name, email, and case details / message'
      });
    }

    await ContactMessage.create({
      name: name.trim(),
      email: email.trim(),
      message: bodyText
    });

    if (process.env.MAIL_USER && process.env.MAIL_PASS) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS
          }
        });

        await transporter.sendMail({
          from:    `"LegalLink Contact" <${process.env.MAIL_USER}>`,
          to:      process.env.MAIL_TO || process.env.MAIL_USER,
          subject: `New Contact Request from ${name.trim()}`,
          html: `
            <h2>New LegalLink Contact Request</h2>
            <p><strong>Full name:</strong> ${escapeHtml(name.trim())}</p>
            <p><strong>Email:</strong> ${escapeHtml(email.trim())}</p>
            <p><strong>Case details:</strong></p>
            <p style="background:#f9fafb;padding:12px;border-radius:8px;white-space:pre-wrap">${escapeHtml(bodyText)}</p>
            <p style="color:#9ca3af;font-size:12px">Submitted at ${new Date().toLocaleString('en-IN')}</p>
          `
        });
      } catch (mailErr) {
        console.warn('Contact email send failed:', mailErr.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Thank you! We will get back to you within 24 hours.'
    });
  } catch (err) {
    console.error('submitContact:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

exports.getAllContacts = async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, total: messages.length, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
