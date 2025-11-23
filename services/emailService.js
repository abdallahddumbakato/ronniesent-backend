import nodemailer from 'nodemailer';
import { generateSubscriptionReceiptPDF } from './receiptService.js'; // Import PDF generator
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

// ✅ ADD DIAGNOSTIC CODE RIGHT HERE:
console.log('🔧 Email Service - Checking environment variables:');
console.log('📧 GMAIL_CLIENT_ID:', process.env.GMAIL_CLIENT_ID ? '*** Set ***' : '❌ Missing');
console.log('🔑 GMAIL_CLIENT_SECRET:', process.env.GMAIL_CLIENT_SECRET ? '*** Set ***' : '❌ Missing');
console.log('🔄 GMAIL_REFRESH_TOKEN:', process.env.GMAIL_REFRESH_TOKEN ? '*** Set ***' : '❌ Missing');
console.log('👤 GMAIL_USER:', process.env.GMAIL_USER ? '*** Set ***' : '❌ Missing');
console.log('📧 EMAIL_USER (old):', process.env.EMAIL_USER ? '*** Set ***' : '❌ Missing');

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'https://ronniesent-backend.onrender.com/auth/callback'
);

// Set credentials
oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN
});

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create transporter using Gmail API with better error handling
const createTransporter = async () => {
  try {
    console.log('🔧 Creating Gmail API transporter...');
    
    // Verify OAuth2 credentials first
    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    // Get access token to verify it works
    const { token } = await oauth2Client.getAccessToken();
    console.log('✅ Access token obtained successfully');

    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_USER,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: token
      }
    });
  } catch (error) {
    console.error('❌ Failed to create Gmail API transporter:', error);
    throw error;
  }
};

// Create transporter immediately
let transporter;
createTransporter().then(t => {
  transporter = t;
  console.log('✅ Gmail API transporter ready');
}).catch(error => {
  console.error('❌ Gmail API setup failed:', error);
});

// Welcome email for new registrations
export const sendWelcomeEmail = async (email, fullName, password, whatsappLink) => {
  try {
    // Ronnie logo path for email attachment
    const ronnieLogoPath = path.join(__dirname, '..', 'public', 'RONNIE.png');

    const mailOptions = {
      from: `"Ronnie's Entertainment" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Welcome to Ronnie\'s Entertainment - Your Account is Ready!',
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Welcome to Ronnie's Entertainment - Your Account is Ready!</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f1f5f8;
            font-family: 'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .header {
            background-color: #f1f5f8;
            padding: 20px 0;
        }
        .logo {
            text-align: center;
            padding: 20px;
        }
        .logo img {
            max-width: 100%;
            height: auto;
        }
        .content {
            padding: 20px;
            color: #022e63;
        }
        .footer {
            background-color: #273458;
            color: #FFFFFF;
            padding: 20px;
            text-align: center;
        }
        .social-links {
            text-align: center;
            padding: 10px 0;
        }
        .social-links a {
            display: inline-block;
            margin: 0 5px;
        }
        .account-details {
            background-color: #f8f9fa;
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
        }
        .center {
            text-align: center;
        }
        .disclaimer {
            font-size: 10px;
            margin-top: 20px;
        }
        .whatsapp-section {
            background-color: #1a9247;
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
            text-align: center;
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <div class="logo" style="text-align: center; padding-bottom: 20px;">
                <a href="https://www.ronniesent.com" target="_blank">
                <img src="cid:ronnieLogo" alt="Ronnie's Entertainment Logo" style="width: 150px;">
                </a>  
            </div>
            <h2 class="center">WELCOME TO RONNIE'S ENTERTAINMENT</h2>
            
            <p class="center">
                <strong>Ronnie's Entertainment</strong><br>
                ${process.env.GMAIL_USER}
            </p>

            <p>Dear ${fullName},</p>

            <p>Welcome to Ronnie's Entertainment! Your account has been successfully created and is ready to use.</p>

            <div class="account-details">
                <strong>Your Login Details:</strong><br>
                Email: <b>${email}</b><br>
                Password: <b>${password}</b>
            </div>

            <div class="whatsapp-section">
                <h3 style="color: white; margin: 0 0 15px 0;">📱 Get Started on WhatsApp</h3>
                <p style="color: white; margin: 0 0 15px 0;">Click below to receive your credentials via WhatsApp:</p>
                <a href="${whatsappLink}" 
                   style="background: white; color: #1a9247; padding: 12px 25px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                  Open WhatsApp
                </a>
            </div>

            <p>You can now login to access thousands of movies and enjoy our platform.</p>

            <div style="text-align: center; margin: 20px 0;">
              <a href="https://www.ronniesent.com/login" 
                 style="background: #6A0DAD; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Login to Ronnie's Entertainment
              </a>
            </div>

            <p>If you have any questions, feel free to contact our support team.</p>

            <p>Kind Regards,<br>
            <strong>Ronnie's Entertainment Team</strong></p>
        </div>

        <div class="footer">
            <div class="contact-info">
                <strong>RONNIE'S ENTERTAINMENT SUPPORT</strong><br>
                Kampala, Uganda<br>
                +256 783 650857 | +256 742 555553
            </div>

            <div class="social-links">
                <a href="https://www.facebook.com/RonnieEntertain/" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-facebook-48.png" alt="Facebook" width="24" height="24">
                </a>
                <a href="https://wa.me/256742555553" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-whatsapp-48.png" alt="WhatsApp" width="24" height="24">
                </a>
                <a href="https://www.ronniesent.com" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-link-48.png" alt="Website" width="24" height="24">
                </a>
                <a href="https://www.youtube.com/@ronnieentertainment7676" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-youtube-48.png" alt="YouTube" width="24" height="24">
                </a>
            </div>

            <div class="disclaimer">
                <p>The information contained in this communication from the sender is confidential. Interception of this email is prohibited. It is intended solely for use by the recipient and others authorized to receive it. If you are not the recipient, you are hereby notified that any disclosure, copying, distribution or taking action in relation to the contents of this information is strictly prohibited and may be unlawful.</p>
            </div>
        </div>
    </div>
</body>
</html>
      `,
      attachments: [{
        filename: 'RONNIE.png',
        path: ronnieLogoPath,
        cid: 'ronnieLogo'
      }],
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    return false;
  }
};

// Password reset email
export const sendPasswordResetEmail = async (email, otp, fullName) => {
  try {
    // Ronnie logo path for email attachment
    const ronnieLogoPath = path.join(__dirname, '..', 'public', 'RONNIE.png');

    const mailOptions = {
      from: `"Ronnie's Entertainment" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Code - Ronnie\'s Entertainment',
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Password Reset Code - Ronnie's Entertainment</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f1f5f8;
            font-family: 'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .header {
            background-color: #f1f5f8;
            padding: 20px 0;
        }
        .logo {
            text-align: center;
            padding: 20px;
        }
        .logo img {
            max-width: 100%;
            height: auto;
        }
        .content {
            padding: 20px;
            color: #022e63;
        }
        .footer {
            background-color: #273458;
            color: #FFFFFF;
            padding: 20px;
            text-align: center;
        }
        .social-links {
            text-align: center;
            padding: 10px 0;
        }
        .social-links a {
            display: inline-block;
            margin: 0 5px;
        }
        .reset-code {
            background-color: #f8f9fa;
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
            text-align: center;
        }
        .center {
            text-align: center;
        }
        .disclaimer {
            font-size: 10px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <div class="logo" style="text-align: center; padding-bottom: 20px;">
                <a href="https://www.ronniesent.com" target="_blank">
                <img src="cid:ronnieLogo" alt="Ronnie's Entertainment Logo" style="width: 150px;">
                </a>  
            </div>
            <h2 class="center">PASSWORD RESET CODE</h2>
            
            <p class="center">
                <strong>Ronnie's Entertainment</strong><br>
                ${process.env.GMAIL_USER}
            </p>

            <p>Dear ${fullName},</p>

            <p>You requested a password reset for your Ronnie's Entertainment account.</p>

            <div class="reset-code">
                <strong>Your Reset Code:</strong><br>
                <div style="font-size: 32px; font-weight: bold; color: #6A0DAD; letter-spacing: 5px; margin: 15px 0;">
                    ${otp}
                </div>
                <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes</p>
            </div>

            <p>If you didn't request this reset, please ignore this email.</p>

            <p>Kind Regards,<br>
            <strong>Ronnie's Entertainment Team</strong></p>
        </div>

        <div class="footer">
            <div class="contact-info">
                <strong>RONNIE'S ENTERTAINMENT SUPPORT</strong><br>
                Kampala, Uganda<br>
                +256 783 650857 | +256 742 555553
            </div>

            <div class="social-links">
                <a href="https://www.facebook.com/RonnieEntertain/" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-facebook-48.png" alt="Facebook" width="24" height="24">
                </a>
                <a href="https://wa.me/256742555553" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-whatsapp-48.png" alt="WhatsApp" width="24" height="24">
                </a>
                <a href="https://www.ronniesent.com" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-link-48.png" alt="Website" width="24" height="24">
                </a>
                <a href="https://www.youtube.com/@ronnieentertainment7676" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-youtube-48.png" alt="YouTube" width="24" height="24">
                </a>
            </div>

            <div class="disclaimer">
                <p>The information contained in this communication from the sender is confidential. Interception of this email is prohibited. It is intended solely for use by the recipient and others authorized to receive it. If you are not the recipient, you are hereby notified that any disclosure, copying, distribution or taking action in relation to the contents of this information is strictly prohibited and may be unlawful.</p>
            </div>
        </div>
    </div>
</body>
</html>
      `,
      attachments: [{
        filename: 'RONNIE.png',
        path: ronnieLogoPath,
        cid: 'ronnieLogo'
      }],
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    return false;
  }
};

// Password changed confirmation
export const sendPasswordChangedEmail = async (email, fullName) => {
  try {
    // Ronnie logo path for email attachment
    const ronnieLogoPath = path.join(__dirname, '..', 'public', 'RONNIE.png');

    const mailOptions = {
      from: `"Ronnie's Entertainment" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Password Updated - Ronnie\'s Entertainment',
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Password Updated - Ronnie's Entertainment</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f1f5f8;
            font-family: 'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .header {
            background-color: #f1f5f8;
            padding: 20px 0;
        }
        .logo {
            text-align: center;
            padding: 20px;
        }
        .logo img {
            max-width: 100%;
            height: auto;
        }
        .content {
            padding: 20px;
            color: #022e63;
        }
        .footer {
            background-color: #273458;
            color: #FFFFFF;
            padding: 20px;
            text-align: center;
        }
        .social-links {
            text-align: center;
            padding: 10px 0;
        }
        .social-links a {
            display: inline-block;
            margin: 0 5px;
        }
        .confirmation-message {
            background-color: #e8f5e8;
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
            color: #2d5016;
        }
        .center {
            text-align: center;
        }
        .disclaimer {
            font-size: 10px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <div class="logo" style="text-align: center; padding-bottom: 20px;">
                <a href="https://www.ronniesent.com" target="_blank">
                <img src="cid:ronnieLogo" alt="Ronnie's Entertainment Logo" style="width: 150px;">
                </a>  
            </div>
            <h2 class="center">PASSWORD UPDATED</h2>
            
            <p class="center">
                <strong>Ronnie's Entertainment</strong><br>
                ${process.env.GMAIL_USER}
            </p>

            <p>Dear ${fullName},</p>

            <p>Your Ronnie's Entertainment password has been successfully updated.</p>

            <div class="confirmation-message">
                <p style="margin: 0;">If you made this change, no further action is needed.</p>
            </div>

            <p>If you didn't make this change, please contact our support team immediately.</p>

            <p>Kind Regards,<br>
            <strong>Ronnie's Entertainment Team</strong></p>
        </div>

        <div class="footer">
            <div class="contact-info">
                <strong>RONNIE'S ENTERTAINMENT SUPPORT</strong><br>
                Kampala, Uganda<br>
                +256 783 650857 | +256 742 555553
            </div>

            <div class="social-links">
                <a href="https://www.facebook.com/RonnieEntertain/" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-facebook-48.png" alt="Facebook" width="24" height="24">
                </a>
                <a href="https://wa.me/256742555553" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-whatsapp-48.png" alt="WhatsApp" width="24" height="24">
                </a>
                <a href="https://www.ronniesent.com" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-link-48.png" alt="Website" width="24" height="24">
                </a>
                <a href="https://www.youtube.com/@ronnieentertainment7676" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-youtube-48.png" alt="YouTube" width="24" height="24">
                </a>
            </div>

            <div class="disclaimer">
                <p>The information contained in this communication from the sender is confidential. Interception of this email is prohibited. It is intended solely for use by the recipient and others authorized to receive it. If you are not the recipient, you are hereby notified that any disclosure, copying, distribution or taking action in relation to the contents of this information is strictly prohibited and may be unlawful.</p>
            </div>
        </div>
    </div>
</body>
</html>
      `,
      attachments: [{
        filename: 'RONNIE.png',
        path: ronnieLogoPath,
        cid: 'ronnieLogo'
      }],
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('❌ Error sending password changed email:', error);
    return false;
  }
};

// Payment confirmation email to customer (UPDATED WITH PDF ATTACHMENT)
export const sendPaymentConfirmationEmail = async (email, fullName, amount, confirmationCode, transactionId, planName) => {
  try {
    // Generate PDF receipt
    const { pdfBuffer, fileName } = await generateSubscriptionReceiptPDF({
      email,
      fullName,
      planName,
      amount,
      transactionId,
      transactionDate: new Date()
    });

    // Ronnie logo path for email attachment
    const ronnieLogoPath = path.join(__dirname, '..', 'public', 'RONNIE.png');

    const mailOptions = {
      from: `"Ronnie's Entertainment" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `Payment Confirmation (Ronnie's Entertainment Ref No. ${transactionId})`,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Payment Confirmation (Ronnie's Entertainment Ref No. ${transactionId})</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f1f5f8;
            font-family: 'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .header {
            background-color: #f1f5f8;
            padding: 20px 0;
        }
        .logo {
            text-align: center;
            padding: 20px;
        }
        .logo img {
            max-width: 100%;
            height: auto;
        }
        .content {
            padding: 20px;
            color: #022e63;
        }
        .footer {
            background-color: #273458;
            color: #FFFFFF;
            padding: 20px;
            text-align: center;
        }
        .social-links {
            text-align: center;
            padding: 10px 0;
        }
        .social-links a {
            display: inline-block;
            margin: 0 5px;
        }
        .payment-details {
            background-color: #f8f9fa;
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
        }
        .center {
            text-align: center;
        }
        .disclaimer {
            font-size: 10px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <div class="logo" style="text-align: center; padding-bottom: 20px;">
                <a href="https://www.ronniesent.com" target="_blank">
                <img src="cid:ronnieLogo" alt="Ronnie's Entertainment Movies Logo" style="width: 150px;">
                </a>  
            </div>
            <h2 class="center">PAYMENT CONFIRMATION</h2>
            
            <p class="center">
                <strong>Ronnie's Entertainment</strong><br>
                ${process.env.GMAIL_USER}
            </p>

            <p>Dear ${fullName},</p>

            <p>Thank you for completing your online payment using DPO Pay. We collect payments on behalf of Ronnie's Entertainment.</p>

            <p>This is a confirmation email to let you know that your payment was successful. Your order details and confirmation will be provided by Ronnie's Entertainment.</p>

            <div class="payment-details">
                <strong>Your mobile pay bill was debited with <b>${amount} UGX</b><br>
                Confirmation code: <b>${confirmationCode}</b></strong>
            </div>

            <p>This payment will be reflected on your statement as DPO*Ronnie's Entertainment.</p>

            <p>Please find attached your subscription receipt and licence agreement for your records.</p>

            <p>Please do not reply to this email, as this mailbox is unmonitored.</p>

            <p>Any queries relating to your order and delivery should be directed to Ronnie's Entertainment through the email ${process.env.GMAIL_USER}</p>

            <p>Kind Regards,<br>
            <strong>Ronnie's Entertainment Team</strong></p>
        </div>

        <div class="footer">
            <div class="contact-info">
                <strong>RONNIE'S ENTERTAINMENT SUPPORT</strong><br>
                Kampala, Uganda<br>
                +256 783 650857 | +256 742 555553
            </div>

            <div class="social-links">
                <a href="https://www.facebook.com/RonnieEntertain/" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-facebook-48.png" alt="Facebook" width="24" height="24">
                </a>
                <a href="https://wa.me/256742555553" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-whatsapp-48.png" alt="WhatsApp" width="24" height="24">
                </a>
                <a href="https://www.ronniesent.com" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-link-48.png" alt="Website" width="24" height="24">
                </a>
                <a href="https://www.youtube.com/@ronnieentertainment7676" target="_blank">
                    <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-youtube-48.png" alt="YouTube" width="24" height="24">
                </a>
            </div>

            <div class="disclaimer">
                <p>The information contained in this communication from the sender is confidential. Interception of this email is prohibited. It is intended solely for use by the recipient and others authorized to receive it. If you are not the recipient, you are hereby notified that any disclosure, copying, distribution or taking action in relation to the contents of this information is strictly prohibited and may be unlawful.</p>
            </div>
        </div>
    </div>
</body>
</html>
      `,
      attachments: [{
        filename: fileName,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }, {
        filename: 'RONNIE.png',
        path: ronnieLogoPath,
        cid: 'ronnieLogo'
      }],
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('❌ Error sending payment confirmation email:', error);
    return false;
  }
};

// Admin notification for payment received
export const sendAdminPaymentNotification = async (customerName, amount, confirmationCode, transactionId) => {
  try {

    // Ronnie logo path for email attachment
    const ronnieLogoPath = path.join(__dirname, '..', 'public', 'RONNIE.png');

    const mailOptions = {
      from: `"Ronnie's Entertainment" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER, // Send to admin email
      subject: `Payment Notification (Ronnie's Entertainment Ref No. ${transactionId})`,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Payment Notification (Ronnie's Entertainment Ref No. ${transactionId})</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f1f5f8;
            font-family: 'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .header {
            background-color: #f1f5f8;
            padding: 20px 0;
        }
        .logo {
            text-align: center;
            padding: 20px;
        }
        .logo img {
            max-width: 100%;
            height: auto;
        }
        .content {
            padding: 20px;
            color: #022e63;
        }
        .footer {
            background-color: #273458;
            color: #FFFFFF;
            padding: 20px;
            text-align: center;
        }
        .social-links {
            text-align: center;
            padding: 10px 0;
        }
        .social-links a {
            display: inline-block;
            margin: 0 5px;
        }
        .payment-details {
            background-color: #f8f9fa;
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
        }
        .center {
            text-align: center;
        }
        .disclaimer {
            font-size: 10px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <div class="logo" style="text-align: center; padding-bottom: 20px;">
                <a href="https://www.ronniesent.com" target="_blank">
                <img src="cid:ronnieLogo" alt="Ronnie's Entertainment Movies Logo" style="width: 150px;">
                </a>  
            </div>
            <h2 class="center">PAYMENT RECEIVED NOTIFICATION</h2>
            
            <p class="center">
                <strong>Ronnie's Entertainment</strong><br>
                ${process.env.GMAIL_USER}
            </p>

            <p>Dear Admin,</p>

            <p>A new payment has been successfully processed through DPO Pay.</p>

            <div class="payment-details">
                <strong>Payment Details:</strong><br>
                Customer Name: <b>${customerName}</b><br>
                Amount: <b>${amount} UGX</b><br>
                Confirmation Code: <b>${confirmationCode}</b><br>
                Transaction ID: <b>${transactionId}</b><br>
                Date: <b>${new Date().toLocaleDateString()}</b>
            </div>

            <p>This payment will be reflected on the merchant statement as DPO*Ronnie's Entertainment.</p>

            <p>Please log into the admin portal to view complete transaction details.</p>

            <p>Kind Regards,<br>
            <strong>Ronnie's Entertainment System</strong></p>
        </div>

        <div class="footer">
            <div class="contact-info">
                <strong>RONNIE'S ENTERTAINMENT ADMIN</strong><br>
                Kampala, Uganda<br>
                +256 783 650857 | +256 742 555553
            </div>

            <div class="disclaimer">
                <p>This is an automated notification from Ronnie's Entertainment payment system.</p>
            </div>
        </div>
    </div>
</body>
</html>
      `,
      attachments: [{
        filename: 'RONNIE.png',
        path: ronnieLogoPath,
        cid: 'ronnieLogo' // ← This matches the cid:ronnieLogo in the HTML
      }],
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('❌ Error sending admin payment notification:', error);
    return false;
  }
};

