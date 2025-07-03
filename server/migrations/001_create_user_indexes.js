// server/migrations/001_create_user_indexes.js
// Migration: Create user collection indexes
// Created: 2024-07-02T00:00:00Z

module.exports = {
  async up(db, mongoose) {
    console.log('Creating user collection indexes...');
    
    // Email index (unique)
    await db.collection('users').createIndex(
      { email: 1 }, 
      { unique: true, name: 'users_email_unique' }
    );
    
    // Username index (unique)
    await db.collection('users').createIndex(
      { username: 1 }, 
      { unique: true, name: 'users_username_unique' }
    );
    
    // Stripe customer ID index for billing
    await db.collection('users').createIndex(
      { 'subscription.stripeCustomerId': 1 }, 
      { sparse: true, name: 'users_stripe_customer_id' }
    );
    
    // Created date index for analytics
    await db.collection('users').createIndex(
      { createdAt: -1 }, 
      { name: 'users_created_at_desc' }
    );
    
    // Email verification token index
    await db.collection('users').createIndex(
      { emailVerificationToken: 1 }, 
      { sparse: true, name: 'users_email_verification_token' }
    );
    
    // Password reset token index
    await db.collection('users').createIndex(
      { passwordResetToken: 1 }, 
      { sparse: true, name: 'users_password_reset_token' }
    );
    
    console.log('✅ User indexes created successfully');
  },

  async down(db, mongoose) {
    console.log('Dropping user collection indexes...');
    
    await db.collection('users').dropIndex('users_email_unique');
    await db.collection('users').dropIndex('users_username_unique');
    await db.collection('users').dropIndex('users_stripe_customer_id');
    await db.collection('users').dropIndex('users_created_at_desc');
    await db.collection('users').dropIndex('users_email_verification_token');
    await db.collection('users').dropIndex('users_password_reset_token');
    
    console.log('✅ User indexes dropped successfully');
  }
};

// server/migrations/002_create_games_indexes.js
// Migration: Create games collection indexes
// Created: 2024-07-02T00:00:00Z

module.exports = {
  async up(db, mongoose) {
    console.log('Creating games collection indexes...');
    
    // Owner index for user's games
    await db.collection('games').createIndex(
      { owner: 1 }, 
      { name: 'games_owner' }
    );
    
    // Collaborators index for shared games
    await db.collection('games').createIndex(
      { 'collaborators.user': 1 }, 
      { name: 'games_collaborators_user' }
    );
    
    // Publishing status index for public games
    await db.collection('games').createIndex(
      { 'publishing.status': 1 }, 
      { name: 'games_publishing_status' }
    );
    
    // Created date index for sorting
    await db.collection('games').createIndex(
      { createdAt: -1 }, 
      { name: 'games_created_at_desc' }
    );
    
    // Updated date index for recent activity
    await db.collection('games').createIndex(
      { updatedAt: -1 }, 
      { name: 'games_updated_at_desc' }
    );
    
    // Views index for popular games
    await db.collection('games').createIndex(
      { 'publishing.views': -1 }, 
      { name: 'games_views_desc' }
    );
    
    // Genre index for filtering
    await db.collection('games').createIndex(
      { 'metadata.genre': 1 }, 
      { name: 'games_genre' }
    );
    
    // Tags index for search
    await db.collection('games').createIndex(
      { 'metadata.tags': 1 }, 
      { name: 'games_tags' }
    );
    
    // Compound index for public games sorted by views
    await db.collection('games').createIndex(
      { 'publishing.status': 1, 'publishing.views': -1 }, 
      { name: 'games_public_by_views' }
    );
    
    console.log('✅ Games indexes created successfully');
  },

  async down(db, mongoose) {
    console.log('Dropping games collection indexes...');
    
    await db.collection('games').dropIndex('games_owner');
    await db.collection('games').dropIndex('games_collaborators_user');
    await db.collection('games').dropIndex('games_publishing_status');
    await db.collection('games').dropIndex('games_created_at_desc');
    await db.collection('games').dropIndex('games_updated_at_desc');
    await db.collection('games').dropIndex('games_views_desc');
    await db.collection('games').dropIndex('games_genre');
    await db.collection('games').dropIndex('games_tags');
    await db.collection('games').dropIndex('games_public_by_views');
    
    console.log('✅ Games indexes dropped successfully');
  }
};

// server/migrations/003_create_assets_indexes.js
// Migration: Create assets collection indexes
// Created: 2024-07-02T00:00:00Z

module.exports = {
  async up(db, mongoose) {
    console.log('Creating assets collection indexes...');
    
    // Owner index for user's assets
    await db.collection('assets').createIndex(
      { owner: 1 }, 
      { name: 'assets_owner' }
    );
    
    // Game index for game assets
    await db.collection('assets').createIndex(
      { game: 1 }, 
      { name: 'assets_game' }
    );
    
    // Type index for filtering by asset type
    await db.collection('assets').createIndex(
      { type: 1 }, 
      { name: 'assets_type' }
    );
    
    // Created date index for sorting
    await db.collection('assets').createIndex(
      { createdAt: -1 }, 
      { name: 'assets_created_at_desc' }
    );
    
    // Size index for storage analytics
    await db.collection('assets').createIndex(
      { size: 1 }, 
      { name: 'assets_size' }
    );
    
    // Public assets index for marketplace
    await db.collection('assets').createIndex(
      { 'sharing.public': 1 }, 
      { name: 'assets_public' }
    );
    
    // Marketplace listings index
    await db.collection('assets').createIndex(
      { 'sharing.marketplace.listed': 1 }, 
      { name: 'assets_marketplace_listed' }
    );
    
    // Compound index for owner's assets by type
    await db.collection('assets').createIndex(
      { owner: 1, type: 1 }, 
      { name: 'assets_owner_type' }
    );
    
    // Compound index for game assets by type
    await db.collection('assets').createIndex(
      { game: 1, type: 1 }, 
      { name: 'assets_game_type' }
    );
    
    console.log('✅ Assets indexes created successfully');
  },

  async down(db, mongoose) {
    console.log('Dropping assets collection indexes...');
    
    await db.collection('assets').dropIndex('assets_owner');
    await db.collection('assets').dropIndex('assets_game');
    await db.collection('assets').dropIndex('assets_type');
    await db.collection('assets').dropIndex('assets_created_at_desc');
    await db.collection('assets').dropIndex('assets_size');
    await db.collection('assets').dropIndex('assets_public');
    await db.collection('assets').dropIndex('assets_marketplace_listed');
    await db.collection('assets').dropIndex('assets_owner_type');
    await db.collection('assets').dropIndex('assets_game_type');
    
    console.log('✅ Assets indexes dropped successfully');
  }
};

// server/migrations/004_create_sessions_collection.js
// Migration: Create sessions collection for real-time collaboration
// Created: 2024-07-02T00:00:00Z

module.exports = {
  async up(db, mongoose) {
    console.log('Creating collaboration sessions collection...');
    
    // Create collection with validation
    await db.createCollection('collaborationsessions', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['projectId', 'participants', 'createdAt'],
          properties: {
            projectId: { bsonType: 'objectId' },
            participants: {
              bsonType: 'array',
              items: {
                bsonType: 'object',
                required: ['userId', 'socketId', 'joinedAt'],
                properties: {
                  userId: { bsonType: 'objectId' },
                  socketId: { bsonType: 'string' },
                  username: { bsonType: 'string' },
                  cursor: { bsonType: 'object' },
                  selection: { bsonType: 'object' },
                  viewport: { bsonType: 'object' },
                  status: { 
                    bsonType: 'string',
                    enum: ['active', 'idle', 'away']
                  },
                  joinedAt: { bsonType: 'date' }
                }
              }
            },
            operations: {
              bsonType: 'array',
              items: {
                bsonType: 'object',
                required: ['id', 'type', 'userId', 'timestamp'],
                properties: {
                  id: { bsonType: 'string' },
                  type: { bsonType: 'string' },
                  payload: { bsonType: 'object' },
                  userId: { bsonType: 'objectId' },
                  username: { bsonType: 'string' },
                  timestamp: { bsonType: 'date' },
                  lamportClock: { bsonType: 'number' }
                }
              }
            },
            createdAt: { bsonType: 'date' },
            lastActivity: { bsonType: 'date' }
          }
        }
      }
    });
    
    // Project ID index for finding sessions
    await db.collection('collaborationsessions').createIndex(
      { projectId: 1 }, 
      { name: 'sessions_project_id' }
    );
    
    // Participants user ID index
    await db.collection('collaborationsessions').createIndex(
      { 'participants.userId': 1 }, 
      { name: 'sessions_participants_user_id' }
    );
    
    // Socket ID index for quick lookups
    await db.collection('collaborationsessions').createIndex(
      { 'participants.socketId': 1 }, 
      { name: 'sessions_participants_socket_id' }
    );
    
    // Last activity index for cleanup
    await db.collection('collaborationsessions').createIndex(
      { lastActivity: 1 }, 
      { name: 'sessions_last_activity' }
    );
    
    // TTL index for automatic cleanup (sessions older than 24 hours)
    await db.collection('collaborationsessions').createIndex(
      { lastActivity: 1 }, 
      { 
        expireAfterSeconds: 86400, // 24 hours
        name: 'sessions_ttl'
      }
    );
    
    console.log('✅ Collaboration sessions collection created successfully');
  },

  async down(db, mongoose) {
    console.log('Dropping collaboration sessions collection...');
    
    await db.collection('collaborationsessions').drop();
    
    console.log('✅ Collaboration sessions collection dropped successfully');
  }
};

// server/migrations/005_create_usage_tracking.js
// Migration: Create usage tracking for subscription limits
// Created: 2024-07-02T00:00:00Z

module.exports = {
  async up(db, mongoose) {
    console.log('Setting up usage tracking...');
    
    // Add usage tracking to existing users
    await db.collection('users').updateMany(
      { usage: { $exists: false } },
      {
        $set: {
          usage: {
            projectsCreated: 0,
            storageUsed: 0,
            aiRequestsThisMonth: 0,
            aiRequestsTotal: 0,
            collaborationMinutesThisMonth: 0,
            lastResetDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }
      }
    );
    
    // Create usage snapshots collection for analytics
    await db.createCollection('usagesnapshots', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['userId', 'date', 'metrics'],
          properties: {
            userId: { bsonType: 'objectId' },
            date: { bsonType: 'date' },
            metrics: {
              bsonType: 'object',
              properties: {
                projectsCreated: { bsonType: 'number' },
                storageUsed: { bsonType: 'number' },
                aiRequests: { bsonType: 'number' },
                collaborationMinutes: { bsonType: 'number' },
                plan: { bsonType: 'string' }
              }
            }
          }
        }
      }
    });
    
    // User ID and date index for usage snapshots
    await db.collection('usagesnapshots').createIndex(
      { userId: 1, date: -1 }, 
      { name: 'usage_snapshots_user_date' }
    );
    
    // Date index for cleanup
    await db.collection('usagesnapshots').createIndex(
      { date: 1 }, 
      { name: 'usage_snapshots_date' }
    );
    
    console.log('✅ Usage tracking setup completed');
  },

  async down(db, mongoose) {
    console.log('Removing usage tracking...');
    
    // Remove usage field from users
    await db.collection('users').updateMany(
      {},
      { $unset: { usage: 1 } }
    );
    
    // Drop usage snapshots collection
    await db.collection('usagesnapshots').drop();
    
    console.log('✅ Usage tracking removed successfully');
  }
};

// server/migrations/006_add_subscription_defaults.js
// Migration: Add default subscription data to existing users
// Created: 2024-07-02T00:00:00Z

module.exports = {
  async up(db, mongoose) {
    console.log('Adding default subscription data to users...');
    
    // Update users without subscription data
    await db.collection('users').updateMany(
      { subscription: { $exists: false } },
      {
        $set: {
          subscription: {
            plan: 'free',
            status: 'active',
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            cancelAt: null,
            cancelledAt: null,
            hasHadPaidPlan: false,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }
      }
    );
    
    // Update users with incomplete subscription data
    await db.collection('users').updateMany(
      { 
        subscription: { $exists: true },
        'subscription.hasHadPaidPlan': { $exists: false }
      },
      {
        $set: {
          'subscription.hasHadPaidPlan': false,
          'subscription.updatedAt': new Date()
        }
      }
    );
    
    console.log('✅ Default subscription data added successfully');
  },

  async down(db, mongoose) {
    console.log('Removing subscription data from users...');
    
    // Remove subscription field from all users
    await db.collection('users').updateMany(
      {},
      { $unset: { subscription: 1 } }
    );
    
    console.log('✅ Subscription data removed successfully');
  }
};