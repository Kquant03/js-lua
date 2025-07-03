// server/services/payments.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../database/models/user');
const emailService = require('./email');

class PaymentService {
  constructor() {
    this.initialized = false;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    // Subscription plans configuration
    this.plans = {
      free: {
        id: 'free',
        name: 'Free',
        price: 0,
        features: {
          projects: 3,
          collaborators: 2,
          storageGB: 1,
          aiRequestsPerMonth: 50,
          exportFormats: ['web'],
          priority: 'low'
        }
      },
      pro: {
        id: 'pro',
        name: 'Pro',
        stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
        price: 19.99,
        features: {
          projects: -1, // unlimited
          collaborators: 10,
          storageGB: 10,
          aiRequestsPerMonth: 500,
          exportFormats: ['web', 'desktop', 'mobile'],
          priority: 'high',
          advancedTools: true,
          assetMarketplace: true
        }
      },
      team: {
        id: 'team',
        name: 'Team',
        stripePriceId: process.env.STRIPE_TEAM_PRICE_ID,
        price: 49.99,
        features: {
          projects: -1,
          collaborators: -1, // unlimited
          storageGB: 100,
          aiRequestsPerMonth: 2000,
          exportFormats: ['web', 'desktop', 'mobile', 'console'],
          priority: 'highest',
          advancedTools: true,
          assetMarketplace: true,
          teamWorkspaces: true,
          analytics: true,
          prioritySupport: true
        }
      }
    };
  }

  async initialize() {
    if (this.initialized) return;

    // Validate Stripe configuration
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }

    // Test Stripe connection
    try {
      await stripe.accounts.retrieve();
      console.log('✅ Stripe connection validated');
    } catch (error) {
      throw new Error(`Stripe connection failed: ${error.message}`);
    }

    this.initialized = true;
    console.log('✅ Payment service initialized');
  }

  // Create or retrieve Stripe customer
  async getOrCreateCustomer(user) {
    await this.initialize();

    // Return existing customer if available
    if (user.subscription?.stripeCustomerId) {
      try {
        const customer = await stripe.customers.retrieve(user.subscription.stripeCustomerId);
        if (!customer.deleted) return customer;
      } catch (error) {
        console.warn('Failed to retrieve existing Stripe customer:', error.message);
      }
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.profile?.displayName || user.username,
      metadata: {
        userId: user._id.toString(),
        username: user.username
      }
    });

    // Update user with Stripe customer ID
    await User.findByIdAndUpdate(user._id, {
      'subscription.stripeCustomerId': customer.id
    });

    return customer;
  }

  // Create checkout session for subscription
  async createCheckoutSession(userId, planId, options = {}) {
    await this.initialize();

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const plan = this.plans[planId];
    if (!plan || planId === 'free') {
      throw new Error('Invalid plan for checkout');
    }

    const customer = await this.getOrCreateCustomer(user);

    const sessionConfig = {
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.APP_URL}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/settings/billing?cancelled=true`,
      metadata: {
        userId: user._id.toString(),
        planId: planId
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      tax_id_collection: {
        enabled: true,
      }
    };

    // Add trial period for first-time subscribers
    if (!user.subscription?.hasHadPaidPlan) {
      sessionConfig.subscription_data = {
        trial_period_days: 14,
        metadata: {
          userId: user._id.toString(),
          planId: planId
        }
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return {
      sessionId: session.id,
      url: session.url
    };
  }

  // Handle subscription changes
  async changeSubscription(userId, newPlanId) {
    await this.initialize();

    const user = await User.findById(userId);
    if (!user?.subscription?.stripeCustomerId) {
      throw new Error('No active subscription found');
    }

    const newPlan = this.plans[newPlanId];
    if (!newPlan) throw new Error('Invalid plan');

    // Get current subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: user.subscription.stripeCustomerId,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      throw new Error('No active subscription found');
    }

    const subscription = subscriptions.data[0];

    if (newPlanId === 'free') {
      // Cancel subscription (downgrade to free)
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true
      });

      await User.findByIdAndUpdate(userId, {
        'subscription.plan': 'free',
        'subscription.status': 'cancelling',
        'subscription.cancelAt': new Date(subscription.current_period_end * 1000)
      });

      return { success: true, action: 'cancelled' };
    } else {
      // Update subscription to new plan
      await stripe.subscriptions.update(subscription.id, {
        items: [{
          id: subscription.items.data[0].id,
          price: newPlan.stripePriceId,
        }],
        proration_behavior: 'create_prorations',
      });

      await User.findByIdAndUpdate(userId, {
        'subscription.plan': newPlanId,
        'subscription.status': 'active'
      });

      return { success: true, action: 'updated' };
    }
  }

  // Cancel subscription
  async cancelSubscription(userId, immediately = false) {
    await this.initialize();

    const user = await User.findById(userId);
    if (!user?.subscription?.stripeCustomerId) {
      throw new Error('No subscription found');
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: user.subscription.stripeCustomerId,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      throw new Error('No active subscription found');
    }

    const subscription = subscriptions.data[0];

    if (immediately) {
      await stripe.subscriptions.cancel(subscription.id);
      await User.findByIdAndUpdate(userId, {
        'subscription.plan': 'free',
        'subscription.status': 'cancelled',
        'subscription.cancelledAt': new Date()
      });
    } else {
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true
      });
      await User.findByIdAndUpdate(userId, {
        'subscription.status': 'cancelling',
        'subscription.cancelAt': new Date(subscription.current_period_end * 1000)
      });
    }

    return { success: true, immediately };
  }

  // Get billing portal session
  async createBillingPortalSession(userId) {
    await this.initialize();

    const user = await User.findById(userId);
    if (!user?.subscription?.stripeCustomerId) {
      throw new Error('No customer found');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.subscription.stripeCustomerId,
      return_url: `${process.env.APP_URL}/settings/billing`,
    });

    return { url: session.url };
  }

  // Handle Stripe webhooks
  async handleWebhook(rawBody, signature) {
    await this.initialize();

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (error) {
      throw new Error(`Webhook signature verification failed: ${error.message}`);
    }

    console.log(`📧 Received Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancelled(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    return { received: true };
  }

  async handleCheckoutCompleted(session) {
    const userId = session.metadata.userId;
    const planId = session.metadata.planId;

    if (!userId || !planId) {
      console.error('Missing metadata in checkout session');
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error(`User not found: ${userId}`);
      return;
    }

    // Get the subscription
    const subscription = await stripe.subscriptions.retrieve(session.subscription);

    await User.findByIdAndUpdate(userId, {
      'subscription.plan': planId,
      'subscription.status': subscription.status,
      'subscription.stripeSubscriptionId': subscription.id,
      'subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000),
      'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
      'subscription.hasHadPaidPlan': true
    });

    // Send confirmation email
    await emailService.sendPaymentConfirmation(user, {
      plan: this.plans[planId].name,
      amount: `$${this.plans[planId].price}`,
      nextBillingDate: new Date(subscription.current_period_end * 1000).toLocaleDateString(),
      invoiceUrl: session.invoice ? `https://dashboard.stripe.com/invoices/${session.invoice}` : null
    });

    console.log(`✅ Subscription activated for user ${user.username}`);
  }

  async handleSubscriptionUpdated(subscription) {
    const customer = await stripe.customers.retrieve(subscription.customer);
    const userId = customer.metadata.userId;

    if (!userId) return;

    const user = await User.findById(userId);
    if (!user) return;

    // Determine plan from price
    let planId = 'free';
    for (const [id, plan] of Object.entries(this.plans)) {
      if (plan.stripePriceId === subscription.items.data[0].price.id) {
        planId = id;
        break;
      }
    }

    await User.findByIdAndUpdate(userId, {
      'subscription.plan': planId,
      'subscription.status': subscription.status,
      'subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000),
      'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000)
    });

    console.log(`✅ Subscription updated for user ${user.username}: ${planId}`);
  }

  async handleSubscriptionCancelled(subscription) {
    const customer = await stripe.customers.retrieve(subscription.customer);
    const userId = customer.metadata.userId;

    if (!userId) return;

    await User.findByIdAndUpdate(userId, {
      'subscription.plan': 'free',
      'subscription.status': 'cancelled',
      'subscription.cancelledAt': new Date()
    });

    console.log(`✅ Subscription cancelled for user ID ${userId}`);
  }

  async handlePaymentSucceeded(invoice) {
    // Handle successful recurring payment
    console.log(`💰 Payment succeeded: ${invoice.id}`);
  }

  async handlePaymentFailed(invoice) {
    // Handle failed payment - could send dunning emails
    console.log(`❌ Payment failed: ${invoice.id}`);
  }

  // Usage tracking and enforcement
  async checkUsageLimit(userId, resource, amount = 1) {
    const user = await User.findById(userId).populate('usage');
    if (!user) throw new Error('User not found');

    const plan = this.plans[user.subscription?.plan || 'free'];
    const limits = plan.features;

    switch (resource) {
      case 'projects':
        if (limits.projects !== -1 && user.usage.projectsCreated + amount > limits.projects) {
          return { allowed: false, limit: limits.projects, current: user.usage.projectsCreated };
        }
        break;

      case 'storage':
        const currentStorageGB = user.usage.storageUsed / (1024 * 1024 * 1024);
        if (currentStorageGB + amount > limits.storageGB) {
          return { allowed: false, limit: limits.storageGB, current: currentStorageGB };
        }
        break;

      case 'aiRequests':
        if (user.usage.aiRequestsThisMonth + amount > limits.aiRequestsPerMonth) {
          return { allowed: false, limit: limits.aiRequestsPerMonth, current: user.usage.aiRequestsThisMonth };
        }
        break;
    }

    return { allowed: true };
  }

  // Get plan features for a user
  getUserPlanFeatures(user) {
    const planId = user.subscription?.plan || 'free';
    return this.plans[planId].features;
  }

  // Utility methods
  getPlanById(planId) {
    return this.plans[planId];
  }

  getAllPlans() {
    return Object.values(this.plans);
  }

  formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  }
}

// Singleton instance
const paymentService = new PaymentService();

module.exports = paymentService;