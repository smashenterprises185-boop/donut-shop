require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS, Images)
app.use(express.static(path.join(__dirname)));

// ==========================================
// FAST GMAIL SMTP TRANSPORTER
// ==========================================
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verify SMTP connection locally only (prevents Vercel serverless cold-start delays)
if (process.env.NODE_ENV !== 'production') {
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ SMTP Connection Error:', error.message);
      console.error('⚠️ Ensure EMAIL_USER and EMAIL_PASS are correctly set in your environment variables');
    } else {
      console.log('✅ SMTP Server connected successfully');
    }
  });
}

// ==========================================
// API ROUTES (ASYNC/AWAIT FOR VERCEL SERVERLESS)
// ==========================================

// 1. CONTACT FORM SUBMISSION
app.post('/api/contact', async (req, res) => {
  try {
    const { firstName, lastName, email, address, phone, postalCode } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !address || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields (firstName, lastName, email, address, phone).'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    const mailOptions = {
      from: `"Donut Shop Contact" <${process.env.EMAIL_USER}>`,
      replyTo: email,
      to: 'muhammadmaarij631@gmail.com',
      subject: `📩 New Contact Form Submission: ${firstName} ${lastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
          <h2 style="color: #2b1f31; border-bottom: 2px solid #2b1f31; padding-bottom: 8px;">📩 New Inquiry Received</h2>
          <p><strong>First Name:</strong> ${firstName}</p>
          <p><strong>Last Name:</strong> ${lastName}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Address:</strong> ${address}</p>
          <p><strong>Postal Code:</strong> ${postalCode || 'N/A'}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;">
          <p style="font-size: 12px; color: #888; text-align: center;">Sent from Donut Shop Contact Form</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Contact email sent:', info.messageId);

    return res.status(200).json({
      success: true,
      message: 'Message sent successfully!'
    });

  } catch (error) {
    console.error('❌ Contact handler error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process contact submission.'
    });
  }
});

// 2. CHECKOUT ORDER SUBMISSION (Handles both /api/order and /api/orders)
const handleOrderSubmission = async (req, res) => {
  try {
    const { customerName, fullName, phone, address, paymentMethod, items } = req.body;
    const name = customerName || fullName || 'Valued Customer';

    if (!phone || !address) {
      return res.status(400).json({
        success: false,
        message: 'Missing phone number or address.'
      });
    }

    const orderItems = items || [];
    let grandTotal = 0;
    
    const itemRowsHTML = orderItems.map(item => {
      const price = parseFloat(item.price) || 0;
      const quantity = parseInt(item.quantity || item.qty, 10) || 1;
      const itemTotal = price * quantity;
      grandTotal += itemTotal;

      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${item.name}</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${price.toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;"><strong>$${itemTotal.toFixed(2)}</strong></td>
        </tr>
      `;
    }).join('');

    const orderMailOptions = {
      from: `"Donut Shop Orders" <${process.env.EMAIL_USER}>`,
      to: 'muhammadmaarij631@gmail.com',
      subject: `🍩 New Order Received from ${name}!`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
          <h2 style="color: #2b1f31; text-align: center; margin-bottom: 5px;">🎉 New Store Order Received!</h2>
          <p style="text-align: center; color: #777; font-size: 13px; margin-top: 0;">Date: ${new Date().toLocaleString()}</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

          <h3 style="color: #444; margin-bottom: 10px;">📦 Customer & Delivery Information</h3>
          <p style="margin: 4px 0;"><strong>Customer Name:</strong> ${name}</p>
          <p style="margin: 4px 0;"><strong>Phone Number:</strong> ${phone}</p>
          <p style="margin: 4px 0;"><strong>Delivery Address:</strong> ${address}</p>
          <p style="margin: 4px 0;"><strong>Payment Method:</strong> ${paymentMethod || 'Cash on Delivery'}</p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

          <h3 style="color: #444; margin-bottom: 10px;">🍩 Ordered Items</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="padding: 8px; text-align: left;">Item</th>
                <th style="padding: 8px; text-align: center;">Qty</th>
                <th style="padding: 8px; text-align: right;">Price</th>
                <th style="padding: 8px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHTML || '<tr><td colspan="4" style="text-align:center;">No items specified</td></tr>'}
            </tbody>
          </table>

          <div style="text-align: right; font-size: 18px; color: #000; padding: 10px 0; border-top: 2px solid #2b1f31;">
            <strong>Grand Total: $${grandTotal.toFixed(2)}</strong>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">Automated Order Alert from Donut Shop Website.</p>
        </div>
      `
    };

    const info = await transporter.sendMail(orderMailOptions);
    console.log('✅ Order email sent:', info.messageId);

    return res.status(200).json({
      success: true,
      message: 'Order placed successfully!'
    });

  } catch (error) {
    console.error('❌ Order handler error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process order.'
    });
  }
};

app.post('/api/orders', handleOrderSubmission);
app.post('/api/order', handleOrderSubmission);

// Page Routing Fallbacks
app.get('/shop', (req, res) => res.sendFile(path.join(__dirname, 'shop.html')));
app.get('/menu', (req, res) => res.sendFile(path.join(__dirname, 'menu.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/contact', (req, res) => {
  if (fs.existsSync(path.join(__dirname, 'contact.html'))) {
    return res.sendFile(path.join(__dirname, 'contact.html'));
  }
  return res.sendFile(path.join(__dirname, 'contactus.html'));
});
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start Server locally
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📧 Destination Email: muhammadmaarij631@gmail.com`);
  });
}

module.exports = app;