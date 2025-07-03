// server/services/email.js
const sgMail = require('@sendgrid/mail');
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');

class EmailService {
  constructor() {
    this.initialized = false;
    this.templates = new Map();
    this.config = {
      provider: process.env.EMAIL_PROVIDER || 'sendgrid',
      from: process.env.EMAIL_FROM || 'noreply@dreammaker.dev',
      replyTo: process.env.EMAIL_REPLY_TO || 'support@dreammaker.dev'
    };
  }

  async initialize() {
    if (this.initialized) return;

    // Configure SendGrid
    if (this.config.provider === 'sendgrid') {
      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) {
        throw new Error('SENDGRID_API_KEY environment variable is required');
      }
      sgMail.setApiKey(apiKey);
    }

    // Load and compile email templates
    await this.loadTemplates();
    
    this.initialized = true;
    console.log('✅ Email service initialized');
  }

  async loadTemplates() {
    const templatesDir = path.join(__dirname, '../templates/email');
    
    const templates = [
      'welcome',
      'email-verification',
      'password-reset',
      'project-invitation',
      'collaboration-notification',
      'payment-confirmation',
      'subscription-cancelled',
      'beta-invitation'
    ];

    for (const templateName of templates) {
      try {
        const htmlPath = path.join(templatesDir, `${templateName}.html`);
        const textPath = path.join(templatesDir, `${templateName}.txt`);
        
        const [htmlTemplate, textTemplate] = await Promise.all([
          fs.readFile(htmlPath, 'utf8').catch(() => null),
          fs.readFile(textPath, 'utf8').catch(() => null)
        ]);

        this.templates.set(templateName, {
          html: htmlTemplate ? handlebars.compile(htmlTemplate) : null,
          text: textTemplate ? handlebars.compile(textTemplate) : null
        });
      } catch (error) {
        console.warn(`⚠️ Failed to load email template: ${templateName}`, error.message);
      }
    }
  }

  async sendEmail(options) {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      to,
      template,
      subject,
      data = {},
      attachments = [],
      priority = 'normal'
    } = options;

    try {
      let html, text;

      if (template && this.templates.has(template)) {
        const compiledTemplate = this.templates.get(template);
        html = compiledTemplate.html ? compiledTemplate.html(data) : null;
        text = compiledTemplate.text ? compiledTemplate.text(data) : null;
      }

      const message = {
        to: Array.isArray(to) ? to : [to],
        from: {
          email: this.config.from,
          name: 'DreamMaker Platform'
        },
        replyTo: this.config.replyTo,
        subject,
        html: html || options.html,
        text: text || options.text,
        attachments
      };

      // Add priority headers
      if (priority === 'high') {
        message.headers = {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'high'
        };
      }

      // Send email based on provider
      if (this.config.provider === 'sendgrid') {
        const result = await sgMail.send(message);
        return {
          success: true,
          messageId: result[0].headers['x-message-id'],
          provider: 'sendgrid'
        };
      }

      throw new Error(`Unsupported email provider: ${this.config.provider}`);

    } catch (error) {
      console.error('❌ Email sending failed:', error);
      
      // Don't throw in production - log and continue
      if (process.env.NODE_ENV === 'production') {
        // Could implement fallback provider here
        return {
          success: false,
          error: error.message,
          provider: this.config.provider
        };
      }
      
      throw error;
    }
  }

  // Convenience methods for common email types
  async sendWelcomeEmail(user) {
    return this.sendEmail({
      to: user.email,
      template: 'welcome',
      subject: 'Welcome to DreamMaker! 🎮',
      data: {
        username: user.username,
        displayName: user.profile?.displayName || user.username,
        verificationUrl: `${process.env.APP_URL}/verify-email?token=${user.emailVerificationToken}`,
        appUrl: process.env.APP_URL
      }
    });
  }

  async sendEmailVerification(user) {
    return this.sendEmail({
      to: user.email,
      template: 'email-verification',
      subject: 'Verify your DreamMaker email address',
      data: {
        username: user.username,
        verificationUrl: `${process.env.APP_URL}/verify-email?token=${user.emailVerificationToken}`,
        expiresIn: '24 hours'
      }
    });
  }

  async sendPasswordReset(user, resetToken) {
    return this.sendEmail({
      to: user.email,
      template: 'password-reset',
      subject: 'Reset your DreamMaker password',
      data: {
        username: user.username,
        resetUrl: `${process.env.APP_URL}/reset-password?token=${resetToken}`,
        expiresIn: '1 hour'
      },
      priority: 'high'
    });
  }

  async sendProjectInvitation(invitation) {
    const { invitedUser, inviter, project } = invitation;
    
    return this.sendEmail({
      to: invitedUser.email,
      template: 'project-invitation',
      subject: `${inviter.username} invited you to collaborate on "${project.name}"`,
      data: {
        invitedUsername: invitedUser.username,
        inviterUsername: inviter.username,
        inviterDisplayName: inviter.profile?.displayName || inviter.username,
        projectName: project.name,
        projectDescription: project.description,
        role: invitation.role,
        acceptUrl: `${process.env.APP_URL}/projects/${project.id}/accept-invitation?token=${invitation.token}`,
        declineUrl: `${process.env.APP_URL}/projects/${project.id}/decline-invitation?token=${invitation.token}`
      }
    });
  }

  async sendCollaborationNotification(notification) {
    const { user, project, activity, collaborator } = notification;
    
    return this.sendEmail({
      to: user.email,
      template: 'collaboration-notification',
      subject: `New activity in "${project.name}"`,
      data: {
        username: user.username,
        projectName: project.name,
        collaboratorName: collaborator.username,
        activity: activity.type,
        activityDescription: this.getActivityDescription(activity),
        projectUrl: `${process.env.APP_URL}/projects/${project.id}`,
        unsubscribeUrl: `${process.env.APP_URL}/settings/notifications`
      }
    });
  }

  async sendPaymentConfirmation(user, subscription) {
    return this.sendEmail({
      to: user.email,
      template: 'payment-confirmation',
      subject: 'Payment confirmed - Welcome to DreamMaker Pro! 🚀',
      data: {
        username: user.username,
        planName: subscription.plan,
        amount: subscription.amount,
        nextBillingDate: subscription.nextBillingDate,
        invoiceUrl: subscription.invoiceUrl,
        manageUrl: `${process.env.APP_URL}/settings/billing`
      }
    });
  }

  async sendBetaInvitation(email, inviteCode) {
    return this.sendEmail({
      to: email,
      template: 'beta-invitation',
      subject: '🎮 You\'re invited to the DreamMaker Beta!',
      data: {
        inviteCode,
        signupUrl: `${process.env.APP_URL}/signup?invite=${inviteCode}`,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()
      },
      priority: 'high'
    });
  }

  getActivityDescription(activity) {
    const descriptions = {
      'entity-create': 'created a new entity',
      'entity-update': 'updated an entity',
      'entity-delete': 'deleted an entity',
      'scene-update': 'modified a scene',
      'script-update': 'updated a script',
      'asset-upload': 'uploaded a new asset',
      'project-publish': 'published the project'
    };
    
    return descriptions[activity.type] || 'made changes to the project';
  }

  // Batch email sending for announcements
  async sendBulkEmail(recipients, emailOptions) {
    const batchSize = 100; // SendGrid limit
    const results = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      try {
        const batchPromises = batch.map(recipient => 
          this.sendEmail({
            ...emailOptions,
            to: recipient.email,
            data: {
              ...emailOptions.data,
              username: recipient.username,
              ...recipient.customData
            }
          })
        );

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);

        // Rate limiting - wait between batches
        if (i + batchSize < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`❌ Batch email failed for batch starting at ${i}:`, error);
      }
    }

    return results;
  }

  // Email validation
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Test email functionality
  async testConnection() {
    try {
      await this.sendEmail({
        to: 'test@example.com',
        subject: 'DreamMaker Email Service Test',
        text: 'This is a test email to verify the email service is working correctly.',
        html: '<p>This is a test email to verify the email service is working correctly.</p>'
      });
      return { success: true, message: 'Email service is working correctly' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
const emailService = new EmailService();

module.exports = emailService;