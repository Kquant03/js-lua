const Joi = require('joi');

// Custom validation helpers
const mongoId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ID format');
const username = Joi.string().alphanum().min(3).max(30).message('Username must be 3-30 alphanumeric characters');
const password = Joi.string().min(8).max(128).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)'))
  .message('Password must be 8+ characters with at least one uppercase, lowercase, and number');
const email = Joi.string().email().max(255).message('Valid email address required');

// User validation schemas
const userSchemas = {
  register: Joi.object({
    username: username.required(),
    email: email.required(),
    password: password.required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
      .messages({ 'any.only': 'Passwords must match' }),
    acceptTerms: Joi.boolean().valid(true).required()
      .messages({ 'any.only': 'You must accept the terms of service' })
  }),

  login: Joi.object({
    login: Joi.string().required().max(255), // Can be username or email
    password: Joi.string().required().max(128),
    rememberMe: Joi.boolean().default(false)
  }),

  updateProfile: Joi.object({
    'profile.displayName': Joi.string().max(100).allow(''),
    'profile.bio': Joi.string().max(500).allow(''),
    'profile.website': Joi.string().uri().max(255).allow(''),
    'profile.location': Joi.string().max(100).allow(''),
    'profile.skills': Joi.array().items(Joi.string().max(50)).max(20),
    'profile.socialLinks': Joi.object({
      twitter: Joi.string().max(50).allow(''),
      github: Joi.string().max(50).allow(''),
      linkedin: Joi.string().max(50).allow(''),
      discord: Joi.string().max(50).allow(''),
      website: Joi.string().uri().max(255).allow('')
    }),
    'settings.theme': Joi.string().valid('light', 'dark', 'auto'),
    'settings.language': Joi.string().max(10),
    'settings.notifications': Joi.object({
      email: Joi.boolean(),
      browser: Joi.boolean(),
      collaboration: Joi.boolean(),
      marketing: Joi.boolean()
    }),
    'settings.privacy': Joi.object({
      showOnlineStatus: Joi.boolean(),
      allowCollaboration: Joi.boolean(),
      profileVisibility: Joi.string().valid('public', 'private')
    })
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required().max(128),
    newPassword: password.required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
      .messages({ 'any.only': 'Passwords must match' })
  }),

  forgotPassword: Joi.object({
    email: email.required()
  }),

  resetPassword: Joi.object({
    token: Joi.string().required().max(255),
    newPassword: password.required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
      .messages({ 'any.only': 'Passwords must match' })
  }),

  verifyEmail: Joi.object({
    token: Joi.string().required().max(255)
  })
};

// Game validation schemas
const gameSchemas = {
  create: Joi.object({
    name: Joi.string().required().min(1).max(100).trim(),
    description: Joi.string().max(1000).allow('').trim(),
    genre: Joi.string().max(50).allow(''),
    template: Joi.string().max(50).allow(''),
    isPublic: Joi.boolean().default(false)
  }),

  update: Joi.object({
    name: Joi.string().min(1).max(100).trim(),
    description: Joi.string().max(1000).allow('').trim(),
    gameData: Joi.object({
      settings: Joi.object().unknown(true),
      entities: Joi.object().unknown(true),
      scenes: Joi.object().unknown(true),
      scripts: Joi.object().unknown(true),
      assets: Joi.object().unknown(true)
    }),
    metadata: Joi.object({
      genre: Joi.string().max(50).allow(''),
      tags: Joi.array().items(Joi.string().max(30)).max(20),
      targetAudience: Joi.string().valid('everyone', 'kids', 'teens', 'adults'),
      estimatedPlayTime: Joi.number().integer().min(0).max(10000), // minutes
      difficulty: Joi.string().valid('easy', 'medium', 'hard')
    }),
    publishing: Joi.object({
      status: Joi.string().valid('private', 'public', 'published')
    }),
    changelog: Joi.string().max(1000).allow('')
  }),

  addCollaborator: Joi.object({
    username: username.required(),
    role: Joi.string().valid('owner', 'editor', 'viewer').default('editor'),
    permissions: Joi.object({
      canEdit: Joi.boolean().default(true),
      canInvite: Joi.boolean().default(false),
      canExport: Joi.boolean().default(true),
      canDelete: Joi.boolean().default(false)
    })
  }),

  updateCollaborator: Joi.object({
    role: Joi.string().valid('owner', 'editor', 'viewer'),
    permissions: Joi.object({
      canEdit: Joi.boolean(),
      canInvite: Joi.boolean(),
      canExport: Joi.boolean(),
      canDelete: Joi.boolean()
    })
  }),

  clone: Joi.object({
    name: Joi.string().min(1).max(100).trim()
  }),

  rate: Joi.object({
    rating: Joi.number().integer().min(1).max(5).required(),
    review: Joi.string().max(1000).allow('').trim()
  })
};

// Asset validation schemas
const assetSchemas = {
  upload: Joi.object({
    gameId: mongoId.allow(''),
    description: Joi.string().max(500).allow('').trim(),
    isPublic: Joi.boolean().default(false),
    tags: Joi.array().items(Joi.string().max(30)).max(10)
  }),

  update: Joi.object({
    name: Joi.string().min(1).max(255).trim(),
    description: Joi.string().max(500).allow('').trim(),
    gameId: mongoId.allow(null),
    isPublic: Joi.boolean(),
    tags: Joi.array().items(Joi.string().max(30)).max(10),
    sharing: Joi.object({
      public: Joi.boolean(),
      marketplace: Joi.object({
        listed: Joi.boolean(),
        price: Joi.number().integer().min(0).max(100000), // cents
        license: Joi.string().valid('proprietary', 'cc0', 'cc-by', 'cc-by-sa')
      })
    })
  })
};

// AI validation schemas
const aiSchemas = {
  openai: Joi.object({
    model: Joi.string().valid('gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo').default('gpt-3.5-turbo'),
    messages: Joi.array().items(
      Joi.object({
        role: Joi.string().valid('system', 'user', 'assistant').required(),
        content: Joi.string().required().max(10000)
      })
    ).min(1).max(50).required(),
    max_tokens: Joi.number().integer().min(1).max(4000).default(1000),
    temperature: Joi.number().min(0).max(2).default(0.7),
    top_p: Joi.number().min(0).max(1).default(1),
    frequency_penalty: Joi.number().min(-2).max(2).default(0),
    presence_penalty: Joi.number().min(-2).max(2).default(0)
  }),

  claude: Joi.object({
    messages: Joi.array().items(
      Joi.object({
        role: Joi.string().valid('user', 'assistant').required(),
        content: Joi.string().required().max(10000)
      })
    ).min(1).max(50).required(),
    max_tokens: Joi.number().integer().min(1).max(4000).default(1000),
    temperature: Joi.number().min(0).max(1).default(0.7),
    top_p: Joi.number().min(0).max(1).default(1),
    top_k: Joi.number().integer().min(1).max(40).default(5)
  }),

  stability: Joi.object({
    prompt: Joi.string().required().max(2000),
    negative_prompt: Joi.string().max(2000).allow(''),
    style_preset: Joi.string().valid(
      'photographic', 'digital-art', 'comic-book', 'fantasy-art',
      'line-art', 'anime', 'pixel-art', 'low-poly', 'origami'
    ),
    aspect_ratio: Joi.string().valid('1:1', '16:9', '21:9', '2:3', '3:2', '4:5', '5:4', '9:16', '9:21').default('1:1'),
    seed: Joi.number().integer().min(0).max(4294967295),
    output_format: Joi.string().valid('png', 'jpeg', 'webp').default('png')
  })
};

// Collaboration validation schemas
const collaborationSchemas = {
  joinProject: Joi.object({
    projectId: mongoId.required(),
    permissions: Joi.object({
      canEdit: Joi.boolean().default(true),
      canInvite: Joi.boolean().default(false),
      canExport: Joi.boolean().default(true),
      canDelete: Joi.boolean().default(false)
    }),
    reconnecting: Joi.boolean().default(false)
  }),

  operation: Joi.object({
    type: Joi.string().required().max(50),
    payload: Joi.object().required().unknown(true),
    lamportClock: Joi.number().integer().min(0).required(),
    dependencies: Joi.array().items(Joi.string().max(50)).max(10).default([]),
    tool: Joi.string().max(50).allow(''),
    viewport: Joi.object({
      x: Joi.number(),
      y: Joi.number(),
      zoom: Joi.number().min(0.1).max(10)
    }),
    selection: Joi.object({
      entities: Joi.array().items(mongoId).max(100),
      type: Joi.string().valid('single', 'multiple', 'none')
    }),
    batch: Joi.boolean().default(false)
  }),

  batchOperations: Joi.object({
    operations: Joi.array().items(Joi.object().unknown(true)).min(1).max(50).required(),
    description: Joi.string().max(200).allow('')
  }),

  cursorUpdate: Joi.object({
    x: Joi.number().required(),
    y: Joi.number().required(),
    viewport: Joi.object({
      x: Joi.number().required(),
      y: Joi.number().required(),
      zoom: Joi.number().min(0.1).max(10).required()
    })
  }),

  selectionUpdate: Joi.object({
    entities: Joi.array().items(mongoId).max(100).required(),
    type: Joi.string().valid('single', 'multiple', 'none').required()
  }),

  presenceUpdate: Joi.object({
    status: Joi.string().valid('active', 'idle', 'away').required()
  }),

  voiceChatRequest: Joi.object({
    type: Joi.string().valid('invite', 'accept', 'decline', 'end').required(),
    targetUser: mongoId
  }),

  webrtcSignal: Joi.object({
    type: Joi.string().valid('offer', 'answer', 'ice-candidate').required(),
    data: Joi.object().required().unknown(true),
    targetUser: mongoId.required()
  }),

  commentAdd: Joi.object({
    x: Joi.number().required(),
    y: Joi.number().required(),
    content: Joi.string().required().max(1000).trim(),
    entityId: mongoId.allow(null)
  }),

  commentResolve: Joi.object({
    commentId: mongoId.required()
  })
};

// Payment validation schemas
const paymentSchemas = {
  createSubscription: Joi.object({
    planId: Joi.string().valid('pro', 'team', 'enterprise').required(),
    paymentMethodId: Joi.string().required().max(255)
  }),

  updatePaymentMethod: Joi.object({
    paymentMethodId: Joi.string().required().max(255)
  }),

  webhook: Joi.object().unknown(true) // Stripe webhooks have complex structures
};

// Query parameter validation schemas
const querySchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().max(50).default('createdAt'),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),

  gamesList: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('createdAt', 'updatedAt', 'name', 'views', 'likes').default('createdAt'),
    order: Joi.string().valid('asc', 'desc').default('desc'),
    genre: Joi.string().max(50).allow(''),
    featured: Joi.boolean(),
    search: Joi.string().max(100).allow(''),
    owner: mongoId.allow(''),
    status: Joi.string().valid('public', 'mine', 'collaborated').allow('')
  }),

  assetsList: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    type: Joi.string().valid('image', 'audio', 'video', 'font', 'data').allow(''),
    gameId: Joi.string().allow('null', '').custom((value) => {
      if (value === 'null') return null;
      if (value === '') return '';
      return mongoId.validate(value).value;
    }),
    search: Joi.string().max(100).allow(''),
    sort: Joi.string().valid('createdAt', 'name', 'size', 'type').default('createdAt'),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),

  userActivity: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    type: Joi.string().max(50).allow('')
  }),

  gameRatings: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10)
  })
};

// Create validation middleware factory
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'query' ? req.query : req.body;
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        timestamp: new Date().toISOString()
      });
    }

    if (source === 'query') {
      req.query = value;
    } else {
      req.body = value;
    }

    next();
  };
};

// Sanitize data for security
const sanitize = {
  removeHTML: (str) => str.replace(/<[^>]*>/g, ''),
  normalizeWhitespace: (str) => str.replace(/\s+/g, ' ').trim(),
  escapeRegex: (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
};

// Custom validation functions
const customValidations = {
  isValidGameOperation: (operation) => {
    const validOperations = [
      'entity-create', 'entity-update', 'entity-delete', 'entity-move',
      'component-add', 'component-update', 'component-remove',
      'scene-update', 'script-update', 'asset-assign'
    ];
    return validOperations.includes(operation.type);
  },

  isValidAssetType: (file) => {
    const validTypes = {
      'image/png': ['png'],
      'image/jpeg': ['jpg', 'jpeg'],
      'image/gif': ['gif'],
      'image/webp': ['webp'],
      'audio/mpeg': ['mp3'],
      'audio/wav': ['wav'],
      'audio/ogg': ['ogg'],
      'video/mp4': ['mp4'],
      'application/json': ['json']
    };

    if (!validTypes[file.mimetype]) return false;
    
    const ext = file.originalname.split('.').pop().toLowerCase();
    return validTypes[file.mimetype].includes(ext);
  },

  hasValidImageDimensions: (metadata) => {
    if (!metadata.width || !metadata.height) return false;
    return metadata.width <= 4096 && metadata.height <= 4096 && 
           metadata.width > 0 && metadata.height > 0;
  }
};

module.exports = {
  schemas: {
    user: userSchemas,
    game: gameSchemas,
    asset: assetSchemas,
    ai: aiSchemas,
    collaboration: collaborationSchemas,
    payment: paymentSchemas,
    query: querySchemas
  },
  validate,
  sanitize,
  customValidations,
  
  // Common validation patterns
  patterns: {
    mongoId,
    username,
    password,
    email
  }
};