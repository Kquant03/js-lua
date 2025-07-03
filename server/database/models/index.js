const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_-]+$/
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  profile: {
    displayName: { type: String, default: '' },
    avatar: { type: String, default: null },
    bio: { type: String, default: '', maxlength: 500 },
    website: { type: String, default: '' },
    location: { type: String, default: '' },
    skills: [{ type: String }],
    socialLinks: {
      twitter: { type: String, default: '' },
      github: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      discord: { type: String, default: '' }
    }
  },
  settings: {
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
    language: { type: String, default: 'en' },
    notifications: {
      email: { type: Boolean, default: true },
      browser: { type: Boolean, default: true },
      collaboration: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false }
    },
    privacy: {
      showOnlineStatus: { type: Boolean, default: true },
      allowCollaboration: { type: Boolean, default: true },
      profileVisibility: { type: String, enum: ['public', 'private'], default: 'public' }
    }
  },
  subscription: {
    plan: { type: String, enum: ['free', 'pro', 'team', 'enterprise'], default: 'free' },
    status: { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false }
  },
  usage: {
    projectsCreated: { type: Number, default: 0 },
    aiRequestsThisMonth: { type: Number, default: 0 },
    storageUsed: { type: Number, default: 0 }, // bytes
    collaborationMinutesThisMonth: { type: Number, default: 0 }
  },
  verified: { type: Boolean, default: false },
  verificationToken: { type: String, default: null },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  lastLogin: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// User Schema Methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { userId: this._id, username: this.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.incrementLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { loginAttempts: 1, lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Game/Project Schema
const gameSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    default: '',
    maxlength: 1000
  },
  thumbnail: {
    type: String,
    default: null
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'editor', 'viewer'],
      default: 'editor'
    },
    permissions: {
      canEdit: { type: Boolean, default: true },
      canInvite: { type: Boolean, default: false },
      canExport: { type: Boolean, default: true },
      canDelete: { type: Boolean, default: false }
    },
    joinedAt: { type: Date, default: Date.now }
  }],
  gameData: {
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    entities: { type: mongoose.Schema.Types.Mixed, default: {} },
    scenes: { type: mongoose.Schema.Types.Mixed, default: {} },
    scripts: { type: mongoose.Schema.Types.Mixed, default: {} },
    assets: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  metadata: {
    genre: { type: String, default: '' },
    tags: [{ type: String }],
    targetAudience: { type: String, enum: ['everyone', 'kids', 'teens', 'adults'], default: 'everyone' },
    estimatedPlayTime: { type: Number, default: 0 }, // minutes
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' }
  },
  publishing: {
    status: { type: String, enum: ['private', 'public', 'published'], default: 'private' },
    publishedAt: { type: Date, default: null },
    featured: { type: Boolean, default: false },
    downloads: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 }
    }
  },
  versions: [{
    version: { type: String, required: true },
    changelog: { type: String, default: '' },
    gameData: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  template: { type: String, default: null },
  isPublic: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Asset Schema
const assetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  originalName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: '',
    maxlength: 500
  },
  type: {
    type: String,
    enum: ['image', 'audio', 'video', 'font', 'data'],
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    default: null
  },
  metadata: {
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    duration: { type: Number, default: null }, // for audio/video
    format: { type: String, default: null },
    colorDepth: { type: Number, default: null },
    sampleRate: { type: Number, default: null }, // for audio
    bitrate: { type: Number, default: null }
  },
  processing: {
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'completed' },
    progress: { type: Number, default: 100 },
    error: { type: String, default: null }
  },
  sharing: {
    public: { type: Boolean, default: false },
    marketplace: {
      listed: { type: Boolean, default: false },
      price: { type: Number, default: 0 },
      license: { type: String, enum: ['proprietary', 'cc0', 'cc-by', 'cc-by-sa'], default: 'proprietary' }
    }
  },
  usage: {
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 }
  },
  tags: [{ type: String }],
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Rating/Review Schema
const ratingSchema = new mongoose.Schema({
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    default: '',
    maxlength: 1000
  },
  helpful: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Activity Log Schema
const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'game_created', 'game_updated', 'game_deleted', 'game_published',
      'asset_uploaded', 'asset_updated', 'asset_deleted',
      'collaboration_joined', 'collaboration_left',
      'user_registered', 'user_verified', 'subscription_changed'
    ]
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null }
}, {
  timestamps: true
});

// Collaboration Session Schema
const collaborationSessionSchema = new mongoose.Schema({
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    socketId: { type: String },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
    cursor: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 }
    },
    selection: { type: mongoose.Schema.Types.Mixed, default: {} },
    viewport: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      zoom: { type: Number, default: 1 }
    },
    status: { type: String, enum: ['active', 'idle', 'away'], default: 'active' }
  }],
  operations: [{
    id: { type: String, required: true },
    type: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now },
    lamportClock: { type: Number, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  }],
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// AI Usage Tracking Schema
const aiUsageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  service: {
    type: String,
    enum: ['openai', 'claude', 'stability'],
    required: true
  },
  type: {
    type: String,
    enum: ['text_generation', 'image_generation', 'code_generation'],
    required: true
  },
  tokens: { type: Number, default: 0 },
  cost: { type: Number, default: 0 }, // in cents
  successful: { type: Boolean, default: true },
  error: { type: String, default: null },
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    default: null
  }
}, {
  timestamps: true
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ 'subscription.stripeCustomerId': 1 });

gameSchema.index({ owner: 1 });
gameSchema.index({ 'collaborators.user': 1 });
gameSchema.index({ 'publishing.status': 1 });
gameSchema.index({ 'publishing.featured': 1 });
gameSchema.index({ createdAt: -1 });

assetSchema.index({ owner: 1 });
assetSchema.index({ game: 1 });
assetSchema.index({ type: 1 });
assetSchema.index({ 'sharing.public': 1 });

ratingSchema.index({ game: 1 });
ratingSchema.index({ user: 1, game: 1 }, { unique: true });

activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });

collaborationSessionSchema.index({ game: 1, isActive: 1 });
collaborationSessionSchema.index({ 'participants.user': 1 });

aiUsageSchema.index({ user: 1, createdAt: -1 });
aiUsageSchema.index({ createdAt: -1 }); // for monthly cleanup

// Virtual fields
gameSchema.virtual('likesCount').get(function() {
  return this.publishing.likes.length;
});

userSchema.virtual('storageQuota').get(function() {
  const quotas = {
    free: 500 * 1024 * 1024, // 500MB
    pro: 10 * 1024 * 1024 * 1024, // 10GB
    team: 50 * 1024 * 1024 * 1024, // 50GB
    enterprise: 500 * 1024 * 1024 * 1024 // 500GB
  };
  return quotas[this.subscription.plan] || quotas.free;
});

userSchema.virtual('aiQuotaMonthly').get(function() {
  const quotas = {
    free: 100,
    pro: 1000,
    team: 5000,
    enterprise: 20000
  };
  return quotas[this.subscription.plan] || quotas.free;
});

// Models
const User = mongoose.model('User', userSchema);
const Game = mongoose.model('Game', gameSchema);
const Asset = mongoose.model('Asset', assetSchema);
const Rating = mongoose.model('Rating', ratingSchema);
const Activity = mongoose.model('Activity', activitySchema);
const CollaborationSession = mongoose.model('CollaborationSession', collaborationSessionSchema);
const AIUsage = mongoose.model('AIUsage', aiUsageSchema);

module.exports = {
  User,
  Game,
  Asset,
  Rating,
  Activity,
  CollaborationSession,
  AIUsage
};