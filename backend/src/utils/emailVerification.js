import crypto from 'crypto';

/**
 * Generate a secure verification token
 * @returns {string} A cryptographically secure random token
 */
export function generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a verification token for storage
 * @param {string} token - The plain token to hash
 * @returns {string} The hashed token
 */
export function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Check if a verification token has expired
 * @param {Date|string} sentAt - When the token was sent
 * @param {number} expiryHours - Hours until expiry (default 24)
 * @returns {boolean} True if expired
 */
export function isTokenExpired(sentAt, expiryHours = 24) {
    if (!sentAt) return true;

    const sentDate = sentAt instanceof Date ? sentAt : new Date(sentAt);
    const expiryTime = sentDate.getTime() + (expiryHours * 60 * 60 * 1000);

    return Date.now() > expiryTime;
}

/**
 * Check if user can request another verification email (rate limiting)
 * @param {Date|string} lastSentAt - When the last email was sent
 * @param {number} cooldownMinutes - Minutes to wait between emails (default 1)
 * @returns {boolean} True if can send another email
 */
export function canResendVerification(lastSentAt, cooldownMinutes = 1) {
    if (!lastSentAt) return true;

    const lastSent = lastSentAt instanceof Date ? lastSentAt : new Date(lastSentAt);
    const cooldownTime = lastSent.getTime() + (cooldownMinutes * 60 * 1000);

    return Date.now() > cooldownTime;
}

/**
 * Send verification email (development mode - logs to console)
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {string} token - Verification token
 * @returns {Promise<boolean>} True if sent successfully
 */
export async function sendVerificationEmail(email, name, token) {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/verify-email?token=${token}`;

    // In development, log to console instead of sending email
    if (process.env.NODE_ENV !== 'production' || process.env.SKIP_EMAIL_VERIFICATION === 'true') {
        console.log('\n=== EMAIL VERIFICATION ===');
        console.log(`To: ${email}`);
        console.log(`Name: ${name}`);
        console.log(`Verification URL: ${verificationUrl}`);
        console.log('==========================\n');
        return true;
    }

    // TODO: In production, integrate with actual email service (SendGrid, Gmail SMTP, etc.)
    // Example with nodemailer:
    // const transporter = nodemailer.createTransport({ ... });
    // await transporter.sendMail({
    //   from: process.env.SMTP_FROM,
    //   to: email,
    //   subject: 'Verify Your LegalPro Account',
    //   html: emailTemplate(name, verificationUrl)
    // });

    return true;
}

/**
 * Email template for verification
 * @param {string} name - User's name
 * @param {string} verificationUrl - Verification URL
 * @returns {string} HTML email template
 */
function emailTemplate(name, verificationUrl) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { 
          display: inline-block; 
          padding: 12px 24px; 
          background-color: #4F46E5; 
          color: white; 
          text-decoration: none; 
          border-radius: 6px;
          margin: 20px 0;
        }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Welcome to LegalPro, ${name}!</h2>
        <p>Thank you for registering. Please verify your email address to complete your registration and access all features.</p>
        
        <a href="${verificationUrl}" class="button">Verify Email Address</a>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #4F46E5;">${verificationUrl}</p>
        
        <p><strong>This link expires in 24 hours.</strong></p>
        
        <p>If you didn't create a LegalPro account, please ignore this email.</p>
        
        <div class="footer">
          <p>Best regards,<br>The LegalPro Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
