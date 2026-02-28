import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import logger from '../core/Logger';

// ============================================
// EMAIL PROVIDER INTERFACE
// ============================================

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

interface EmailProvider {
  send(options: EmailOptions): Promise<string | null>;
}

// ============================================
// NODEMAILER PROVIDER (Your existing setup)
// ============================================

class NodemailerProvider implements EmailProvider {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async send(options: EmailOptions): Promise<string | null> {
    try {
      const attachments = (options.attachments ?? []).map((a) => ({
        filename: a.filename,
        content: a.content,
      }));

      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      logger.info('Email sent via Nodemailer', {
        messageId: info.messageId,
        to: options.to,
      });

      return info.messageId;
    } catch (error) {
      logger.error('Nodemailer send failed', { error, to: options.to });
      return null;
    }
  }
}

// ============================================
// RESEND PROVIDER (New - better deliverability)
// ============================================

class ResendProvider implements EmailProvider {
  private client: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required');
    }
    this.client = new Resend(apiKey);
  }

  async send(options: EmailOptions): Promise<string | null> {
    try {
      const attachments = (options.attachments ?? []).map((a) => ({
        filename: a.filename,
        content: a.content.toString('base64'),
      }));

      const { data, error } = await this.client.emails.send({
        from:
          process.env.EMAIL_FROM_ADDRESS || 'Novba <noreply@usenovbaai.com>',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      if (error) {
        logger.error('Resend send failed', { error, to: options.to });
        return null;
      }

      logger.info('Email sent via Resend', {
        emailId: data?.id,
        to: options.to,
      });

      return data?.id || null;
    } catch (error) {
      logger.error('Resend service error', { error, to: options.to });
      return null;
    }
  }
}

// ============================================
// EMAIL SERVICE (Main interface)
// ============================================

class EmailService {
  private provider: EmailProvider;

  constructor() {
    // Choose provider based on environment variable
    // Default to Nodemailer (your existing setup)
    const useResend = process.env.EMAIL_PROVIDER === 'resend';

    if (useResend) {
      logger.info('Using Resend email provider');
      this.provider = new ResendProvider();
    } else {
      logger.info('Using Nodemailer email provider');
      this.provider = new NodemailerProvider();
    }
  }

  /**
   * Send any email (internal)
   */
  private async send(options: EmailOptions): Promise<boolean> {
    const emailId = await this.provider.send(options);
    return emailId !== null;
  }

  /**
   * Send a transactional email with optional attachments.
   * Use for proposal/invoice/contract send flows. Logging is done by the caller via logEmail().
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    return this.send(options);
  }

  /**
   * Send password reset email (YOUR EXISTING LOGIC)
   */
  async sendPasswordResetEmail(
    email: string,
    name: string | null,
    resetToken: string,
  ): Promise<boolean> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reset Your Password - Novba</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f9fafb; padding: 40px; border-radius: 8px;">
            <h1 style="color: #111827; margin: 0 0 20px 0;">Reset Your Password</h1>
            
            <p style="color: #374151; margin: 0 0 20px 0;">
              Hi${name ? ` ${name}` : ''},
            </p>
            
            <p style="color: #374151; margin: 0 0 20px 0;">
              We received a request to reset your password. Click the button below to create a new password:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
              If you didn't request this, you can safely ignore this email.
            </p>
            
            <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
              This link will expire in 1 hour.
            </p>
            
            <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
              If the button doesn't work, copy and paste this link:
              <br>
              <span style="color: #3b82f6; word-break: break-all;">${resetUrl}</span>
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
Reset Your Password

Hi${name ? ` ${name}` : ''},

We received a request to reset your password. Visit this link to create a new password:

${resetUrl}

If you didn't request this, you can safely ignore this email.

This link will expire in 1 hour.

© ${new Date().getFullYear()} Novba
    `.trim();

    return this.send({
      to: email,
      subject: 'Reset Your Password - Novba',
      html,
      text,
    });
  }

  /**
   * Send email verification email (NEW)
   */
  async sendVerificationEmail(
    email: string,
    name: string | null,
    verificationToken: string,
  ): Promise<boolean> {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verify Your Email - Novba</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f9fafb; padding: 40px; border-radius: 8px;">
            <h1 style="color: #111827; margin: 0 0 20px 0;">Welcome to Novba! 👋</h1>
            
            <p style="color: #374151; margin: 0 0 20px 0;">
              Hi${name ? ` ${name}` : ''},
            </p>
            
            <p style="color: #374151; margin: 0 0 20px 0;">
              Thanks for signing up! To get started, please verify your email address:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
              If you didn't create an account, you can safely ignore this email.
            </p>
            
            <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
              This link will expire in 24 hours.
            </p>
            
            <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
              If the button doesn't work, copy and paste this link:
              <br>
              <span style="color: #3b82f6; word-break: break-all;">${verificationUrl}</span>
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
Welcome to Novba!

Hi${name ? ` ${name}` : ''},

Thanks for signing up! To verify your email address, visit:

${verificationUrl}

If you didn't create an account, you can safely ignore this email.

This link will expire in 24 hours.

© ${new Date().getFullYear()} Novba
    `.trim();

    return this.send({
      to: email,
      subject: 'Verify Your Email - Novba',
      html,
      text,
    });
  }

  /**
   * Send welcome email (OPTIONAL - after verification)
   */
  async sendWelcomeEmail(email: string, name: string | null): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Novba!</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f9fafb; padding: 40px; border-radius: 8px;">
            <h1 style="color: #111827; margin: 0 0 20px 0;">You're All Set! 🎉</h1>
            
            <p style="color: #374151; margin: 0 0 20px 0;">
              Hi${name ? ` ${name}` : ''},
            </p>
            
            <p style="color: #374151; margin: 0 0 20px 0;">
              Your email has been verified and you're ready to start using Novba!
            </p>
            
            <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #111827; margin: 0 0 15px 0;">Quick Start Guide:</h3>
              <ol style="color: #374151; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 10px;">Add your first client</li>
                <li style="margin-bottom: 10px;">Create an invoice</li>
                <li style="margin-bottom: 10px;">Get paid!</li>
              </ol>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" 
                 style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold;">
                Go to Dashboard
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
              Need help? Reply to this email or visit our help center.
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
You're All Set!

Hi${name ? ` ${name}` : ''},

Your email has been verified and you're ready to start using Novba!

Quick Start:
1. Add your first client
2. Create an invoice
3. Get paid!

Visit your dashboard: ${process.env.FRONTEND_URL}/dashboard

Need help? Reply to this email.

© ${new Date().getFullYear()} Novba
    `.trim();

    return this.send({
      to: email,
      subject: "You're All Set! - Novba",
      html,
      text,
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Export individual functions for convenience
export const sendPasswordResetEmail =
  emailService.sendPasswordResetEmail.bind(emailService);
export const sendVerificationEmail =
  emailService.sendVerificationEmail.bind(emailService);
export const sendWelcomeEmail =
  emailService.sendWelcomeEmail.bind(emailService);
export const sendEmail = emailService.sendEmail.bind(emailService);
