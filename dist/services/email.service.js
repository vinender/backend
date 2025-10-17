"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = void 0;
//@ts-nocheck
const nodemailer = require('nodemailer');
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
// Email configuration
const EMAIL_HOST = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587');
const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true';
const EMAIL_USER = process.env.SMTP_USER || process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.SMTP_PASS || process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '"Fieldsy" <noreply@fieldsy.com>';
// Create transporter only if email credentials are provided
let transporter = null;
if (EMAIL_USER && EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        secure: EMAIL_SECURE,
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS,
        },
    });
    // Verify transporter connection
    transporter.verify((error, success) => {
        if (error) {
            console.warn('Email service not configured properly:', error.message);
            console.warn('Emails will not be sent. Please configure EMAIL_USER and EMAIL_PASS in .env');
        }
        else {
            console.log('✅ Email service is ready to send messages');
        }
    });
}
else {
    console.warn('⚠️ Email service disabled: EMAIL_USER or EMAIL_PASS not configured in .env');
    console.warn('To enable email verification, please set EMAIL_USER and EMAIL_PASS in your .env file');
}
// Email templates
const getOtpEmailTemplate = (otp, name) => {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f7f7f7;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #4CAF50;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #4CAF50;
          }
          .content {
            padding: 30px 20px;
            text-align: center;
          }
          .otp-code {
            display: inline-block;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #4CAF50;
            background-color: #f0f8f0;
            padding: 15px 30px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #666666;
            font-size: 14px;
            border-top: 1px solid #eeeeee;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 25px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🐾 Fieldsy</div>
          </div>
          <div class="content">
            <h1>Verify Your Email</h1>
            <p>Hi ${name || 'there'},</p>
            <p>Thank you for signing up with Fieldsy! Please use the following verification code to complete your registration:</p>
            <div class="otp-code">${otp}</div>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            <p>If you didn't request this verification, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2025 Fieldsy. All rights reserved.</p>
            <p>Find  or Host secure fields for your furry friends 🐕</p>
          </div>
        </div>
      </body>
    </html>
  `;
};
const getFieldClaimStatusTemplate = (statusData) => {
    const isApproved = statusData.status === 'APPROVED';
    const statusColor = isApproved ? '#4CAF50' : '#f44336';
    const statusText = isApproved ? 'Approved' : 'Rejected';
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Field Claim ${statusText}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f7f7f7;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid ${statusColor};
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #4CAF50;
          }
          .content {
            padding: 30px 20px;
          }
          .status-badge {
            display: inline-block;
            background-color: ${statusColor};
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: bold;
            font-size: 18px;
            margin: 20px 0;
          }
          .info-box {
            background-color: ${isApproved ? '#f0f8f0' : '#fff5f5'};
            border-left: 4px solid ${statusColor};
            padding: 15px;
            margin: 20px 0;
          }
          .next-steps {
            background-color: #fff7e6;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
          }
          .next-steps h3 {
            color: #ff8c00;
            margin-top: 0;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #666666;
            font-size: 14px;
            border-top: 1px solid #eeeeee;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background-color: ${statusColor};
            color: white;
            text-decoration: none;
            border-radius: 25px;
            margin-top: 20px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🐾 Fieldsy</div>
          </div>
          <div class="content">
            <h1>Field Claim ${statusText}</h1>
            <p>Dear ${statusData.fullName},</p>
            
            ${isApproved ? `
              <p>Great news! Your claim for the field has been <strong>approved</strong>. You can now manage your field listing on Fieldsy.</p>
            ` : `
              <p>We regret to inform you that your claim for the field has been <strong>rejected</strong> after careful review.</p>
            `}
            
            <div class="status-badge">Status: ${statusText}</div>
            
            <div class="info-box">
              <h3>Field Details:</h3>
              <p><strong>Field Name:</strong> ${statusData.fieldName}</p>
              <p><strong>Location:</strong> ${statusData.fieldAddress}</p>
              ${statusData.reviewNotes ? `
                <p><strong>Review Notes:</strong> ${statusData.reviewNotes}</p>
              ` : ''}
            </div>
            
            ${statusData.documents && statusData.documents.length > 0 && isApproved ? `
            <div class="info-box">
              <h3>Your Submitted Documents:</h3>
              <p style="margin-bottom: 10px; color: #666;">For your reference, these were the documents you submitted:</p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                ${statusData.documents.map((doc, index) => {
        const fileName = doc.split('/').pop() || `Document ${index + 1}`;
        const isFullUrl = doc.startsWith('http://') || doc.startsWith('https://');
        return `
                    <li style="margin: 8px 0;">
                      ${isFullUrl ?
            `<a href="${doc}" style="color: #4CAF50; text-decoration: none; font-weight: 500;" target="_blank">${fileName}</a>` :
            `<span style="color: #555;">${fileName}</span>`}
                    </li>
                  `;
    }).join('')}
              </ul>
            </div>
            ` : ''}
            
            ${isApproved ? `
              <div class="next-steps">
                <h3>🎉 What's Next?</h3>
                <ul>
                  <li>Log in to your Fieldsy account to manage your field</li>
                  <li>Update your field details and pricing</li>
                  <li>Add high-quality photos to attract more bookings</li>
                  <li>Set your availability and booking rules</li>
                  <li>Start receiving bookings from dog owners!</li>
                </ul>
              </div>
              
              <p>Congratulations on becoming a Fieldsy field owner! We're excited to have you as part of our community.</p>
            ` : `
              <div class="next-steps">
                <h3>📋 What Can You Do?</h3>
                <ul>
                  <li>Review the rejection reason provided above</li>
                  <li>Gather additional documentation if needed</li>
                  <li>Contact our support team for clarification</li>
                  <li>Submit a new claim with updated information</li>
                </ul>
              </div>
              
              <p>If you believe this decision was made in error or have additional documentation to provide, please contact our support team.</p>
            `}
          </div>
          <div class="footer">
            <p>© 2025 Fieldsy. All rights reserved.</p>
            <p>Find  or Host secure fields for your furry friends 🐕</p>
          </div>
        </div>
      </body>
    </html>
  `;
};
const getFieldClaimTemplate = (claimData) => {
    const formattedDate = new Date(claimData.submittedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Field Claim Confirmation</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f7f7f7;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #4CAF50;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #4CAF50;
          }
          .content {
            padding: 30px 20px;
          }
          .status-badge {
            display: inline-block;
            background-color: #FFA500;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            margin: 15px 0;
          }
          .info-box {
            background-color: #f0f8f0;
            border-left: 4px solid #4CAF50;
            padding: 15px;
            margin: 20px 0;
          }
          .info-item {
            margin: 10px 0;
          }
          .info-label {
            font-weight: bold;
            color: #555;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #666666;
            font-size: 14px;
            border-top: 1px solid #eeeeee;
          }
          .next-steps {
            background-color: #fff7e6;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
          }
          .next-steps h3 {
            color: #ff8c00;
            margin-top: 0;
          }
          .next-steps ul {
            margin: 10px 0;
            padding-left: 20px;
          }
          .next-steps li {
            margin: 8px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🐾 Fieldsy</div>
          </div>
          <div class="content">
            <h1>Field Claim Submission Received</h1>
            <p>Dear ${claimData.fullName},</p>
            <p>Thank you for submitting your claim for the field. We have successfully received your submission and our team will review it shortly.</p>
            
            <div class="status-badge">Status: Under Review</div>
            
            <div class="info-box">
              <h3>Claim Details:</h3>
              <div class="info-item">
                <span class="info-label">Field Name:</span> ${claimData.fieldName}
              </div>
              <div class="info-item">
                <span class="info-label">Field Location:</span> ${claimData.fieldAddress}
              </div>
              <div class="info-item">
                <span class="info-label">Submitted By:</span> ${claimData.fullName}
              </div>
              <div class="info-item">
                <span class="info-label">Contact Email:</span> ${claimData.email}
              </div>
              <div class="info-item">
                <span class="info-label">Phone Number:</span> ${claimData.phoneNumber}
              </div>
              <div class="info-item">
                <span class="info-label">Legal Owner:</span> ${claimData.isLegalOwner ? 'Yes' : 'No'}
              </div>
              <div class="info-item">
                <span class="info-label">Submission Date:</span> ${formattedDate}
              </div>
            </div>
            
            ${claimData.documents && claimData.documents.length > 0 ? `
            <div class="info-box">
              <h3>Submitted Documents:</h3>
              <p style="margin-bottom: 10px; color: #666;">The following ownership documents were submitted with your claim:</p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                ${claimData.documents.map((doc, index) => {
        // Extract filename from URL or path
        const fileName = doc.split('/').pop() || `Document ${index + 1}`;
        // Check if it's a full URL or just a path
        const isFullUrl = doc.startsWith('http://') || doc.startsWith('https://');
        return `
                    <li style="margin: 8px 0;">
                      ${isFullUrl ?
            `<a href="${doc}" style="color: #4CAF50; text-decoration: none; font-weight: 500;" target="_blank">${fileName}</a>` :
            `<span style="color: #555;">${fileName}</span>`}
                    </li>
                  `;
    }).join('')}
              </ul>
              <p style="margin-top: 10px; font-size: 12px; color: #888;">
                <em>Note: These documents are securely stored and will be reviewed by our verification team.</em>
              </p>
            </div>
            ` : ''}
            
            <div class="next-steps">
              <h3>📋 What Happens Next?</h3>
              <ul>
                <li>Our verification team will review your submitted documents</li>
                <li>We may contact you if additional information is needed</li>
                <li>You will receive an email notification once your claim is approved or if we need more information</li>
                <li>The typical review process takes 2-3 business days</li>
              </ul>
            </div>
            
            <p><strong>Important:</strong> Please ensure your submitted ownership documents are valid and up-to-date. If we cannot verify your ownership, we may need to request additional documentation.</p>
            
            <p>If you have any questions about your claim or need to provide additional information, please don't hesitate to contact our support team.</p>
            
            <p>Thank you for choosing Fieldsy to list your field!</p>
          </div>
          <div class="footer">
            <p>© 2025 Fieldsy. All rights reserved.</p>
            <p>Find  or Host secure fields for your furry friends 🐕</p>
            <p>This is an automated confirmation email. Please do not reply directly to this message.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};
const getPasswordResetTemplate = (otp, name) => {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f7f7f7;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #4CAF50;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #4CAF50;
          }
          .content {
            padding: 30px 20px;
            text-align: center;
          }
          .otp-code {
            display: inline-block;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #4CAF50;
            background-color: #f0f8f0;
            padding: 15px 30px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #666666;
            font-size: 14px;
            border-top: 1px solid #eeeeee;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🐾 Fieldsy</div>
          </div>
          <div class="content">
            <h1>Password Reset Request</h1>
            <p>Hi ${name || 'there'},</p>
            <p>We received a request to reset your password. Please use the following code to proceed:</p>
            <div class="otp-code">${otp}</div>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>© 2025 Fieldsy. All rights reserved.</p>
            <p>Find  or Host secure fields for your furry friends 🐕</p>
          </div>
        </div>
      </body>
    </html>
  `;
};
const getBookingConfirmationTemplate = (bookingData) => {
    const formattedDate = new Date(bookingData.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f7f7f7;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #4CAF50;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #4CAF50;
          }
          .content {
            padding: 30px 20px;
          }
          .success-badge {
            display: inline-block;
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: bold;
            margin: 15px 0;
          }
          .info-box {
            background-color: #f0f8f0;
            border-left: 4px solid #4CAF50;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .info-item {
            margin: 12px 0;
            font-size: 15px;
          }
          .info-label {
            font-weight: bold;
            color: #555;
            display: inline-block;
            min-width: 120px;
          }
          .price {
            font-size: 24px;
            font-weight: bold;
            color: #4CAF50;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #666666;
            font-size: 14px;
            border-top: 1px solid #eeeeee;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🐾 Fieldsy</div>
          </div>
          <div class="content">
            <h1>Booking Confirmed!</h1>
            <div class="success-badge">✓ Payment Successful</div>
            <p>Dear ${bookingData.userName},</p>
            <p>Your booking has been confirmed and paid for successfully! Get ready for a great time with your furry friend.</p>

            <div class="info-box">
              <h3 style="margin-top: 0;">Booking Details</h3>
              <div class="info-item">
                <span class="info-label">Booking ID:</span> #${bookingData.bookingId.slice(-8).toUpperCase()}
              </div>
              <div class="info-item">
                <span class="info-label">Field:</span> ${bookingData.fieldName}
              </div>
              <div class="info-item">
                <span class="info-label">Location:</span> ${bookingData.fieldAddress}
              </div>
              <div class="info-item">
                <span class="info-label">Date:</span> ${formattedDate}
              </div>
              <div class="info-item">
                <span class="info-label">Time:</span> ${bookingData.startTime} - ${bookingData.endTime}
              </div>
              <div class="info-item">
                <span class="info-label">Field Owner:</span> ${bookingData.fieldOwnerName}
              </div>
              <div class="info-item" style="margin-top: 20px; padding-top: 15px; border-top: 2px dashed #ccc;">
                <span class="info-label">Total Paid:</span> <span class="price">£${bookingData.totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <p><strong>What's Next?</strong></p>
            <ul>
              <li>You'll receive a reminder 24 hours before your booking</li>
              <li>You can contact the field owner through our messaging system</li>
              <li>Please arrive on time to make the most of your booking</li>
              <li>Have fun and enjoy your time at the field!</li>
            </ul>

            <p>If you have any questions or need to make changes to your booking, please contact us through the app.</p>

            <p>Thank you for choosing Fieldsy!</p>
          </div>
          <div class="footer">
            <p>© 2025 Fieldsy. All rights reserved.</p>
            <p>Find  or Host secure fields for your furry friends 🐕</p>
          </div>
        </div>
      </body>
    </html>
  `;
};
const getNewBookingNotificationTemplate = (bookingData) => {
    const formattedDate = new Date(bookingData.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Booking Received</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f7f7f7;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #4CAF50;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #4CAF50;
          }
          .content {
            padding: 30px 20px;
          }
          .new-badge {
            display: inline-block;
            background-color: #FF9800;
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: bold;
            margin: 15px 0;
          }
          .info-box {
            background-color: #fff8e1;
            border-left: 4px solid #FF9800;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .earnings-box {
            background-color: #e8f5e9;
            border-left: 4px solid #4CAF50;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .info-item {
            margin: 12px 0;
            font-size: 15px;
          }
          .info-label {
            font-weight: bold;
            color: #555;
            display: inline-block;
            min-width: 140px;
          }
          .price {
            font-size: 24px;
            font-weight: bold;
            color: #4CAF50;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #666666;
            font-size: 14px;
            border-top: 1px solid #eeeeee;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🐾 Fieldsy</div>
          </div>
          <div class="content">
            <h1>New Booking Received!</h1>
            <div class="new-badge">🎉 New Booking</div>
            <p>Dear ${bookingData.ownerName},</p>
            <p>Great news! You have received a new booking for your field.</p>

            <div class="info-box">
              <h3 style="margin-top: 0;">Booking Details</h3>
              <div class="info-item">
                <span class="info-label">Booking ID:</span> #${bookingData.bookingId.slice(-8).toUpperCase()}
              </div>
              <div class="info-item">
                <span class="info-label">Field:</span> ${bookingData.fieldName}
              </div>
              <div class="info-item">
                <span class="info-label">Customer:</span> ${bookingData.dogOwnerName}
              </div>
              <div class="info-item">
                <span class="info-label">Date:</span> ${formattedDate}
              </div>
              <div class="info-item">
                <span class="info-label">Time:</span> ${bookingData.startTime} - ${bookingData.endTime}
              </div>
            </div>

            <div class="earnings-box">
              <h3 style="margin-top: 0;">💰 Your Earnings</h3>
              <div class="info-item">
                <span class="info-label">Total Booking Price:</span> £${bookingData.totalPrice.toFixed(2)}
              </div>
              <div class="info-item">
                <span class="info-label">Platform Commission:</span> £${bookingData.platformCommission.toFixed(2)}
              </div>
              <div class="info-item" style="margin-top: 15px; padding-top: 15px; border-top: 2px dashed #4CAF50;">
                <span class="info-label">Your Payout:</span> <span class="price">£${bookingData.fieldOwnerAmount.toFixed(2)}</span>
              </div>
            </div>

            <p><strong>What's Next?</strong></p>
            <ul>
              <li>The booking amount has been secured via Stripe</li>
              <li>Your payout will be processed after the booking is completed</li>
              <li>You can message the customer through the app if needed</li>
              <li>Please ensure your field is ready for the booking time</li>
            </ul>

            <p>If you have any questions or concerns, please contact our support team.</p>

            <p>Thank you for being part of Fieldsy!</p>
          </div>
          <div class="footer">
            <p>© 2025 Fieldsy. All rights reserved.</p>
            <p>Find  or Host secure fields for your furry friends 🐕</p>
          </div>
        </div>
      </body>
    </html>
  `;
};
const getFieldSubmissionTemplate = (data) => {
    const formattedDate = new Date(data.submittedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Field Submitted Successfully</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f7f7f7;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #4CAF50;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #4CAF50;
          }
          .content {
            padding: 30px 20px;
          }
          .success-badge {
            display: inline-block;
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: bold;
            margin: 15px 0;
          }
          .info-box {
            background-color: #f0f8f0;
            border-left: 4px solid #4CAF50;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .info-item {
            margin: 12px 0;
            font-size: 15px;
          }
          .info-label {
            font-weight: bold;
            color: #555;
            display: inline-block;
            min-width: 140px;
          }
          .next-steps {
            background-color: #fff7e6;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
          }
          .next-steps h3 {
            color: #ff8c00;
            margin-top: 0;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #666666;
            font-size: 14px;
            border-top: 1px solid #eeeeee;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🐾 Fieldsy</div>
          </div>
          <div class="content">
            <h1>Field Submitted Successfully!</h1>
            <div class="success-badge">✓ Submission Complete</div>
            <p>Dear ${data.ownerName},</p>
            <p>Congratulations! Your field has been successfully submitted to Fieldsy and is now live on our platform.</p>

            <div class="info-box">
              <h3 style="margin-top: 0;">Field Details</h3>
              <div class="info-item">
                <span class="info-label">Field Name:</span> ${data.fieldName}
              </div>
              <div class="info-item">
                <span class="info-label">Location:</span> ${data.fieldAddress}
              </div>
              <div class="info-item">
                <span class="info-label">Submitted On:</span> ${formattedDate}
              </div>
            </div>

            <div class="next-steps">
              <h3>🎉 What's Next?</h3>
              <ul>
                <li>Your field is now visible to dog owners searching for fields</li>
                <li>You'll receive notifications when bookings are made</li>
                <li>You can manage your field details and availability in your dashboard</li>
                <li>Update pricing and booking rules anytime from your account</li>
                <li>Start receiving bookings and earning money!</li>
              </ul>
            </div>

            <p><strong>Important Tips:</strong></p>
            <ul>
              <li>Keep your field information up to date</li>
              <li>Respond promptly to booking requests</li>
              <li>Maintain good communication with dog owners</li>
              <li>Ensure your field is ready before each booking</li>
            </ul>

            <p>Thank you for joining Fieldsy! We're excited to have you as part of our community of field owners.</p>

            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          </div>
          <div class="footer">
            <p>© 2025 Fieldsy. All rights reserved.</p>
            <p>Find  or Host secure fields for your furry friends 🐕</p>
          </div>
        </div>
      </body>
    </html>
  `;
};
const getFieldApprovalTemplate = (data) => {
    const formattedDate = new Date(data.approvedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Field Approved</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f7f7f7;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #4CAF50;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #4CAF50;
          }
          .content {
            padding: 30px 20px;
          }
          .success-badge {
            display: inline-block;
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: bold;
            margin: 15px 0;
          }
          .info-box {
            background-color: #f0f8f0;
            border-left: 4px solid #4CAF50;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .info-item {
            margin: 12px 0;
            font-size: 15px;
          }
          .info-label {
            font-weight: bold;
            color: #555;
            display: inline-block;
            min-width: 140px;
          }
          .next-steps {
            background-color: #fff7e6;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
          }
          .next-steps h3 {
            color: #ff8c00;
            margin-top: 0;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #666666;
            font-size: 14px;
            border-top: 1px solid #eeeeee;
          }
          .celebration {
            text-align: center;
            font-size: 48px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🐾 Fieldsy</div>
          </div>
          <div class="content">
            <div class="celebration">🎉</div>
            <h1 style="text-align: center;">Your Field Has Been Approved!</h1>
            <div class="success-badge" style="display: block; text-align: center;">✓ Approved & Live</div>
            <p>Dear ${data.ownerName},</p>
            <p>Congratulations! Great news - your field has been reviewed and <strong>approved</strong> by our admin team. Your field is now live on Fieldsy and visible to dog owners searching for fields!</p>

            <div class="info-box">
              <h3 style="margin-top: 0;">Field Details</h3>
              <div class="info-item">
                <span class="info-label">Field Name:</span> ${data.fieldName}
              </div>
              <div class="info-item">
                <span class="info-label">Location:</span> ${data.fieldAddress}
              </div>
              <div class="info-item">
                <span class="info-label">Approved On:</span> ${formattedDate}
              </div>
              <div class="info-item">
                <span class="info-label">Status:</span> <span style="color: #4CAF50; font-weight: bold;">Active & Listed</span>
              </div>
            </div>

            <div class="next-steps">
              <h3>🎉 What's Next?</h3>
              <ul>
                <li><strong>Your field is now live</strong> and visible to all dog owners on Fieldsy</li>
                <li><strong>Start receiving bookings</strong> - You'll get email and in-app notifications</li>
                <li><strong>Manage your field</strong> - Update details, pricing, and availability anytime</li>
                <li><strong>Track your earnings</strong> - View booking history and payouts in your dashboard</li>
                <li><strong>Connect with customers</strong> - Respond to inquiries through our messaging system</li>
              </ul>
            </div>

            <p><strong>💰 Payment & Earnings:</strong></p>
            <ul>
              <li>You'll receive 80% of each booking amount (we take 20% platform fee)</li>
              <li>Payments are processed via Stripe after each completed booking</li>
              <li>Set up your Stripe Connect account to receive payouts</li>
            </ul>

            <p><strong>📈 Tips for Success:</strong></p>
            <ul>
              <li>Keep your field information accurate and up to date</li>
              <li>Add high-quality photos to attract more bookings</li>
              <li>Respond promptly to booking requests and messages</li>
              <li>Maintain good communication with dog owners</li>
              <li>Ensure your field is clean and ready before each booking</li>
            </ul>

            <p>Thank you for joining Fieldsy! We're excited to have you as part of our community of field owners helping dogs enjoy safe, secure spaces to play and exercise.</p>

            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>

            <p><strong>Happy hosting!</strong></p>
          </div>
          <div class="footer">
            <p>© 2025 Fieldsy. All rights reserved.</p>
            <p>Find  or Host secure fields for your furry friends 🐕</p>
          </div>
        </div>
      </body>
    </html>
  `;
};
const getBookingStatusChangeTemplate = (emailData) => {
    const formattedDate = new Date(emailData.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const statusColors = {
        'CANCELLED': '#f44336',
        'COMPLETED': '#4CAF50',
        'CONFIRMED': '#2196F3'
    };
    const statusMessages = {
        'CANCELLED': 'Your booking has been cancelled.',
        'COMPLETED': 'Your booking has been completed. We hope you had a great time!',
        'CONFIRMED': 'Your booking has been confirmed.'
    };
    const statusColor = statusColors[emailData.newStatus] || '#FF9800';
    const statusMessage = statusMessages[emailData.newStatus] || `Your booking status has been updated to ${emailData.newStatus}.`;
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Status Update</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f7f7f7;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #4CAF50;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #4CAF50;
          }
          .content {
            padding: 30px 20px;
          }
          .status-badge {
            display: inline-block;
            background-color: ${statusColor};
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: bold;
            margin: 15px 0;
          }
          .info-box {
            background-color: #f5f5f5;
            border-left: 4px solid ${statusColor};
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .info-item {
            margin: 12px 0;
            font-size: 15px;
          }
          .info-label {
            font-weight: bold;
            color: #555;
            display: inline-block;
            min-width: 120px;
          }
          .reason-box {
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #666666;
            font-size: 14px;
            border-top: 1px solid #eeeeee;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🐾 Fieldsy</div>
          </div>
          <div class="content">
            <h1>Booking Status Update</h1>
            <div class="status-badge">${emailData.newStatus}</div>
            <p>Dear ${emailData.userName},</p>
            <p>${statusMessage}</p>

            <div class="info-box">
              <h3 style="margin-top: 0;">Booking Details</h3>
              <div class="info-item">
                <span class="info-label">Booking ID:</span> #${emailData.bookingId.slice(-8).toUpperCase()}
              </div>
              <div class="info-item">
                <span class="info-label">Field:</span> ${emailData.fieldName}
              </div>
              <div class="info-item">
                <span class="info-label">Date:</span> ${formattedDate}
              </div>
              <div class="info-item">
                <span class="info-label">Time:</span> ${emailData.startTime} - ${emailData.endTime}
              </div>
            </div>

            ${emailData.reason ? `
            <div class="reason-box">
              <h3 style="margin-top: 0;">Reason:</h3>
              <p>${emailData.reason}</p>
            </div>
            ` : ''}

            ${emailData.newStatus === 'CANCELLED' ? `
              <p>If you were charged for this booking, a refund will be processed to your original payment method within 5-7 business days.</p>
            ` : ''}

            ${emailData.newStatus === 'COMPLETED' ? `
              <p>We hope you and your furry friend had a wonderful time! If you enjoyed your experience, please consider leaving a review for the field owner.</p>
            ` : ''}

            <p>If you have any questions, please don't hesitate to contact our support team.</p>

            <p>Thank you for using Fieldsy!</p>
          </div>
          <div class="footer">
            <p>© 2025 Fieldsy. All rights reserved.</p>
            <p>Find  or Host secure fields for your furry friends 🐕</p>
          </div>
        </div>
      </body>
    </html>
  `;
};
// Email service class
class EmailService {
    async sendMail(to, subject, html) {
        if (!transporter) {
            console.warn(`⚠️ Email service disabled. OTP for ${to}: ${html.match(/\d{6}/)}`);
            console.warn('Configure EMAIL_USER and EMAIL_PASS in .env to enable email sending');
            return false;
        }
        try {
            const info = await transporter.sendMail({
                from: EMAIL_FROM,
                to,
                subject,
                html,
            });
            console.log('✅ Email sent successfully:', info.messageId);
            return true;
        }
        catch (error) {
            console.error('❌ Failed to send email:', error.message);
            throw new Error('Failed to send email');
        }
    }
    async sendOtpEmail(email, otp, type, name) {
        let subject;
        let html;
        switch (type) {
            case 'RESET_PASSWORD':
                subject = 'Password Reset - Fieldsy';
                html = getPasswordResetTemplate(otp, name);
                break;
            case 'SIGNUP':
            case 'EMAIL_VERIFICATION':
            default:
                subject = 'Email Verification - Fieldsy';
                html = getOtpEmailTemplate(otp, name);
                break;
        }
        return this.sendMail(email, subject, html);
    }
    async sendFieldClaimEmail(claimData) {
        const subject = 'Field Claim Submitted - Fieldsy';
        const html = getFieldClaimTemplate(claimData);
        try {
            const result = await this.sendMail(claimData.email, subject, html);
            console.log(`✅ Field claim confirmation email sent to ${claimData.email}`);
            return result;
        }
        catch (error) {
            console.error(`❌ Failed to send field claim email to ${claimData.email}:`, error);
            // Don't throw error to prevent claim submission from failing
            return false;
        }
    }
    async sendFieldClaimStatusEmail(statusData) {
        const statusText = statusData.status === 'APPROVED' ? 'Approved' : 'Rejected';
        const subject = `Field Claim ${statusText} - Fieldsy`;
        const html = getFieldClaimStatusTemplate({
            fullName: statusData.fullName,
            fieldName: statusData.fieldName,
            fieldAddress: statusData.fieldAddress,
            status: statusData.status,
            reviewNotes: statusData.reviewNotes,
            documents: statusData.documents
        });
        try {
            const result = await this.sendMail(statusData.email, subject, html);
            console.log(`✅ Field claim ${statusText.toLowerCase()} email sent to ${statusData.email}`);
            return result;
        }
        catch (error) {
            console.error(`❌ Failed to send field claim status email to ${statusData.email}:`, error);
            // Don't throw error to prevent status update from failing
            return false;
        }
    }
    async sendBookingConfirmationToDogOwner(bookingData) {
        const subject = 'Booking Confirmed - Fieldsy';
        const html = getBookingConfirmationTemplate(bookingData);
        try {
            const result = await this.sendMail(bookingData.email, subject, html);
            console.log(`✅ Booking confirmation email sent to ${bookingData.email}`);
            return result;
        }
        catch (error) {
            console.error(`❌ Failed to send booking confirmation email to ${bookingData.email}:`, error);
            return false;
        }
    }
    async sendNewBookingNotificationToFieldOwner(bookingData) {
        const subject = 'New Booking Received - Fieldsy';
        const html = getNewBookingNotificationTemplate(bookingData);
        try {
            const result = await this.sendMail(bookingData.email, subject, html);
            console.log(`✅ New booking notification email sent to ${bookingData.email}`);
            return result;
        }
        catch (error) {
            console.error(`❌ Failed to send new booking notification email to ${bookingData.email}:`, error);
            return false;
        }
    }
    async sendBookingStatusChangeEmail(emailData) {
        const subject = `Booking ${emailData.newStatus} - Fieldsy`;
        const html = getBookingStatusChangeTemplate(emailData);
        try {
            const result = await this.sendMail(emailData.email, subject, html);
            console.log(`✅ Booking status change email sent to ${emailData.email}`);
            return result;
        }
        catch (error) {
            console.error(`❌ Failed to send booking status change email to ${emailData.email}:`, error);
            return false;
        }
    }
    async sendFieldSubmissionEmail(data) {
        const subject = 'Field Submitted Successfully - Fieldsy';
        const html = getFieldSubmissionTemplate(data);
        try {
            const result = await this.sendMail(data.email, subject, html);
            console.log(`✅ Field submission email sent to ${data.email}`);
            return result;
        }
        catch (error) {
            console.error(`❌ Failed to send field submission email to ${data.email}:`, error);
            return false;
        }
    }
    async sendFieldApprovalEmail(data) {
        const subject = 'Your Field Has Been Approved! - Fieldsy';
        const html = getFieldApprovalTemplate({
            ownerName: data.ownerName,
            ownerEmail: data.email,
            fieldName: data.fieldName,
            fieldAddress: data.fieldAddress,
            approvedAt: data.approvedAt
        });
        try {
            const result = await this.sendMail(data.email, subject, html);
            console.log(`✅ Field approval email sent to ${data.email}`);
            return result;
        }
        catch (error) {
            console.error(`❌ Failed to send field approval email to ${data.email}:`, error);
            return false;
        }
    }
}
exports.emailService = new EmailService();
