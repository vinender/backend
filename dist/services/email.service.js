"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = void 0;
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
            <p>© 2024 Fieldsy. All rights reserved.</p>
            <p>Find secure fields for your furry friends 🐕</p>
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
            <p>© 2024 Fieldsy. All rights reserved.</p>
            <p>Find secure fields for your furry friends 🐕</p>
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
}
exports.emailService = new EmailService();
