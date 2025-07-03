const mongoose = require('mongoose');
const { User, Game, Asset, Rating, Activity } = require('../database/models');

class DatabaseSeeder {
  constructor() {
    this.sampleUsers = [];
    this.sampleGames = [];
    this.sampleAssets = [];
  }

  async connect() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dreammaker';
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB successfully');
  }

  async disconnect() {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }

  // Clear existing data
  async clearDatabase() {
    console.log('Clearing existing data...');
    
    await User.deleteMany({});
    await Game.deleteMany({});
    await Asset.deleteMany({});
    await Rating.deleteMany({});
    await Activity.deleteMany({});
    
    console.log('Database cleared');
  }

  // Create sample users
  async createUsers() {
    console.log('Creating sample users...');

    const users = [
      {
        username: 'alex_dev',
        email: 'alex@example.com',
        password: 'password123',
        profile: {
          displayName: 'Alex Thompson',
          bio: 'Indie game developer passionate about pixel art and retro games.',
          skills: ['JavaScript', 'Pixel Art', 'Game Design'],
          socialLinks: {
            twitter: 'alexdev',
            github: 'alexthompson'
          }
        },
        subscription: {
          plan: 'pro',
          status: 'active'
        },
        verified: true
      },
      {
        username: 'sarah_designer',
        email: 'sarah@example.com',
        password: 'password123',
        profile: {
          displayName: 'Sarah Chen',
          bio: 'UI/UX designer specializing in mobile game interfaces.',
          skills: ['UI Design', 'Animation', 'Prototyping'],
          socialLinks: {
            twitter: 'sarahdesigns'
          }
        },
        subscription: {
          plan: 'free',
          status: 'active'
        },
        verified: true
      },
      {
        username: 'mike_audio',
        email: 'mike@example.com',
        password: 'password123',
        profile: {
          displayName: 'Mike Rodriguez',
          bio: 'Sound designer and composer for indie games.',
          skills: ['Audio Design', 'Music Composition', 'Sound Effects'],
          socialLinks: {
            twitter: 'mikeaudio',
            website: 'https://mikerodriguez.dev'
          }
        },
        subscription: {
          plan: 'pro',
          status: 'active'
        },
        verified: true
      },
      {
        username: 'team_lead',
        email: 'lead@example.com',
        password: 'password123',
        profile: {
          displayName: 'Jordan Kim',
          bio: 'Technical lead with 10+ years in game development.',
          skills: ['Project Management', 'C#', 'Unity', 'Team Leadership'],
          socialLinks: {
            linkedin: 'jordankim',
            github: 'jordank'
          }
        },
        subscription: {
          plan: 'team',
          status: 'active'
        },
        verified: true
      },
      {
        username: 'indie_creator',
        email: 'indie@example.com',
        password: 'password123',
        profile: {
          displayName: 'Riley Johnson',
          bio: 'Solo indie developer creating narrative-driven games.',
          skills: ['Storytelling', 'Game Design', 'Programming'],
          location: 'Portland, OR'
        },
        subscription: {
          plan: 'free',
          status: 'active'
        },
        verified: true
      }
    ];

    for (const userData of users) {
      const user = new User(userData);
      await user.save();
      this.sampleUsers.push(user);
    }

    console.log(`Created ${this.sampleUsers.length} sample users`);
  }

  // Create sample games
  async createGames() {
    console.log('Creating sample games...');

    const games = [
      {
        name: 'Pixel Adventure Quest',
        description: 'A retro-style platformer with pixel art graphics and challenging levels. Explore ancient dungeons, collect treasures, and defeat magical creatures.',
        owner: this.sampleUsers[0]._id, // alex_dev
        collaborators: [
          {
            user: this.sampleUsers[1]._id, // sarah_designer
            role: 'editor',
            permissions: {
              canEdit: true,
              canInvite: false,
              canExport: true,
              canDelete: false
            }
          }
        ],
        gameData: {
          settings: {
            width: 800,
            height: 600,
            backgroundColor: '#87CEEB'
          },
          entities: {},
          scenes: {
            main: {
              name: 'Main Scene',
              entities: []
            }
          },
          scripts: {},
          assets: {}
        },
        metadata: {
          genre: 'platformer',
          tags: ['retro', 'pixel-art', '2d', 'adventure'],
          targetAudience: 'everyone',
          estimatedPlayTime: 120,
          difficulty: 'medium'
        },
        publishing: {
          status: 'published',
          publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          views: 1250,
          likes: [],
          downloads: 89
        },
        versions: [
          {
            version: 'v1.0',
            changelog: 'Initial release with 10 levels',
            createdBy: this.sampleUsers[0]._id
          }
        ]
      },
      {
        name: 'Space Colony Builder',
        description: 'Build and manage your own space colony on distant planets. Research new technologies, manage resources, and defend against alien threats.',
        owner: this.sampleUsers[3]._id, // team_lead
        collaborators: [
          {
            user: this.sampleUsers[0]._id, // alex_dev
            role: 'editor',
            permissions: {
              canEdit: true,
              canInvite: false,
              canExport: true,
              canDelete: false
            }
          },
          {
            user: this.sampleUsers[2]._id, // mike_audio
            role: 'editor',
            permissions: {
              canEdit: true,
              canInvite: false,
              canExport: false,
              canDelete: false
            }
          }
        ],
        gameData: {
          settings: {
            width: 1024,
            height: 768,
            backgroundColor: '#000033'
          },
          entities: {},
          scenes: {
            main: {
              name: 'Colony View',
              entities: []
            }
          },
          scripts: {},
          assets: {}
        },
        metadata: {
          genre: 'strategy',
          tags: ['sci-fi', 'management', 'strategy', 'building'],
          targetAudience: 'teens',
          estimatedPlayTime: 480,
          difficulty: 'hard'
        },
        publishing: {
          status: 'public',
          views: 845,
          likes: [],
          downloads: 34
        },
        versions: [
          {
            version: 'v0.8',
            changelog: 'Beta version with basic building mechanics',
            createdBy: this.sampleUsers[3]._id
          }
        ]
      },
      {
        name: 'Mystic Forest Tales',
        description: 'An interactive narrative adventure set in an enchanted forest. Make choices that affect the story and discover multiple endings.',
        owner: this.sampleUsers[4]._id, // indie_creator
        gameData: {
          settings: {
            width: 800,
            height: 600,
            backgroundColor: '#2F4F2F'
          },
          entities: {},
          scenes: {
            forest_entrance: {
              name: 'Forest Entrance',
              entities: []
            }
          },
          scripts: {},
          assets: {}
        },
        metadata: {
          genre: 'adventure',
          tags: ['narrative', 'fantasy', 'choices', 'story'],
          targetAudience: 'everyone',
          estimatedPlayTime: 180,
          difficulty: 'easy'
        },
        publishing: {
          status: 'private',
          views: 23,
          likes: [],
          downloads: 2
        },
        versions: [
          {
            version: 'v0.1',
            changelog: 'Initial story structure',
            createdBy: this.sampleUsers[4]._id
          }
        ]
      },
      {
        name: 'Mobile Puzzle Challenge',
        description: 'A collection of brain-teasing puzzles designed for mobile devices. Perfect for quick gaming sessions.',
        owner: this.sampleUsers[1]._id, // sarah_designer
        gameData: {
          settings: {
            width: 360,
            height: 640,
            backgroundColor: '#F0F8FF'
          },
          entities: {},
          scenes: {
            menu: {
              name: 'Main Menu',
              entities: []
            }
          },
          scripts: {},
          assets: {}
        },
        metadata: {
          genre: 'puzzle',
          tags: ['mobile', 'casual', 'brain-teaser', 'minimalist'],
          targetAudience: 'everyone',
          estimatedPlayTime: 30,
          difficulty: 'medium'
        },
        publishing: {
          status: 'public',
          views: 567,
          likes: [],
          downloads: 156
        },
        versions: [
          {
            version: 'v1.2',
            changelog: 'Added 20 new puzzle levels',
            createdBy: this.sampleUsers[1]._id
          }
        ]
      },
      {
        name: 'Retro Racing Championship',
        description: 'Fast-paced arcade racing with retro aesthetics. Compete in championships and customize your vehicles.',
        owner: this.sampleUsers[2]._id, // mike_audio
        collaborators: [
          {
            user: this.sampleUsers[1]._id, // sarah_designer
            role: 'editor',
            permissions: {
              canEdit: true,
              canInvite: false,
              canExport: true,
              canDelete: false
            }
          }
        ],
        gameData: {
          settings: {
            width: 1024,
            height: 768,
            backgroundColor: '#FF6347'
          },
          entities: {},
          scenes: {
            race_track: {
              name: 'Championship Track',
              entities: []
            }
          },
          scripts: {},
          assets: {}
        },
        metadata: {
          genre: 'racing',
          tags: ['retro', 'arcade', 'multiplayer', 'fast-paced'],
          targetAudience: 'teens',
          estimatedPlayTime: 60,
          difficulty: 'medium'
        },
        publishing: {
          status: 'published',
          publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          views: 432,
          likes: [],
          downloads: 67
        },
        versions: [
          {
            version: 'v1.1',
            changelog: 'Added multiplayer racing and new tracks',
            createdBy: this.sampleUsers[2]._id
          }
        ]
      }
    ];

    for (const gameData of games) {
      const game = new Game(gameData);
      await game.save();
      this.sampleGames.push(game);
    }

    console.log(`Created ${this.sampleGames.length} sample games`);
  }

  // Create sample assets
  async createAssets() {
    console.log('Creating sample assets...');

    const assets = [
      {
        name: 'Player Character Sprite',
        originalName: 'player_sprite.png',
        description: 'Main character sprite with walking animation frames',
        type: 'image',
        mimeType: 'image/png',
        size: 15360,
        url: '/uploads/sample-player-sprite.png',
        thumbnailUrl: '/uploads/thumb-player-sprite.png',
        owner: this.sampleUsers[0]._id,
        game: this.sampleGames[0]._id,
        metadata: {
          width: 64,
          height: 64,
          format: 'png',
          colorDepth: 32
        },
        sharing: {
          public: true
        },
        tags: ['character', 'player', 'sprite', 'animation']
      },
      {
        name: 'Forest Background Music',
        originalName: 'forest_theme.mp3',
        description: 'Ambient forest music for exploration scenes',
        type: 'audio',
        mimeType: 'audio/mpeg',
        size: 2048000,
        url: '/uploads/sample-forest-theme.mp3',
        owner: this.sampleUsers[2]._id,
        game: this.sampleGames[2]._id,
        metadata: {
          duration: 120,
          format: 'mp3',
          sampleRate: 44100,
          bitrate: 128
        },
        sharing: {
          public: false
        },
        tags: ['music', 'ambient', 'forest', 'background']
      },
      {
        name: 'UI Button Set',
        originalName: 'ui_buttons.png',
        description: 'Collection of UI buttons for mobile games',
        type: 'image',
        mimeType: 'image/png',
        size: 45600,
        url: '/uploads/sample-ui-buttons.png',
        thumbnailUrl: '/uploads/thumb-ui-buttons.png',
        owner: this.sampleUsers[1]._id,
        game: this.sampleGames[3]._id,
        metadata: {
          width: 512,
          height: 256,
          format: 'png',
          colorDepth: 32
        },
        sharing: {
          public: true,
          marketplace: {
            listed: true,
            price: 500, // $5.00
            license: 'cc-by'
          }
        },
        tags: ['ui', 'buttons', 'interface', 'mobile'],
        usage: {
          views: 45,
          downloads: 12
        }
      },
      {
        name: 'Spaceship Engine Sound',
        originalName: 'engine_loop.wav',
        description: 'Looping spaceship engine sound effect',
        type: 'audio',
        mimeType: 'audio/wav',
        size: 512000,
        url: '/uploads/sample-engine-sound.wav',
        owner: this.sampleUsers[2]._id,
        game: this.sampleGames[1]._id,
        metadata: {
          duration: 5,
          format: 'wav',
          sampleRate: 44100,
          bitrate: 1411
        },
        sharing: {
          public: false
        },
        tags: ['sound-effect', 'spaceship', 'engine', 'loop']
      },
      {
        name: 'Tile Set - Dungeon',
        originalName: 'dungeon_tiles.png',
        description: 'Complete tile set for creating dungeon levels',
        type: 'image',
        mimeType: 'image/png',
        size: 128000,
        url: '/uploads/sample-dungeon-tiles.png',
        thumbnailUrl: '/uploads/thumb-dungeon-tiles.png',
        owner: this.sampleUsers[0]._id,
        game: this.sampleGames[0]._id,
        metadata: {
          width: 512,
          height: 512,
          format: 'png',
          colorDepth: 32
        },
        sharing: {
          public: true
        },
        tags: ['tileset', 'dungeon', 'environment', 'level-design'],
        usage: {
          views: 78,
          downloads: 23
        }
      }
    ];

    for (const assetData of assets) {
      const asset = new Asset(assetData);
      await asset.save();
      this.sampleAssets.push(asset);
    }

    console.log(`Created ${this.sampleAssets.length} sample assets`);
  }

  // Create sample ratings and reviews
  async createRatings() {
    console.log('Creating sample ratings...');

    const ratings = [
      {
        game: this.sampleGames[0]._id, // Pixel Adventure Quest
        user: this.sampleUsers[1]._id,
        rating: 5,
        review: 'Amazing pixel art and really challenging gameplay! Brings back memories of classic platformers.'
      },
      {
        game: this.sampleGames[0]._id,
        user: this.sampleUsers[2]._id,
        rating: 4,
        review: 'Great game, love the retro style. Could use more variety in the soundtrack though.'
      },
      {
        game: this.sampleGames[0]._id,
        user: this.sampleUsers[3]._id,
        rating: 4,
        review: 'Solid platformer with tight controls. The level design is really well thought out.'
      },
      {
        game: this.sampleGames[1]._id, // Space Colony Builder
        user: this.sampleUsers[4]._id,
        rating: 5,
        review: 'Incredibly deep strategy game. I\'ve spent hours building my perfect colony!'
      },
      {
        game: this.sampleGames[1]._id,
        user: this.sampleUsers[1]._id,
        rating: 4,
        review: 'Great concept and execution. The UI could be a bit more intuitive for new players.'
      },
      {
        game: this.sampleGames[3]._id, // Mobile Puzzle Challenge
        user: this.sampleUsers[0]._id,
        rating: 5,
        review: 'Perfect for short gaming sessions. The puzzles are clever and progressively challenging.'
      },
      {
        game: this.sampleGames[4]._id, // Retro Racing Championship
        user: this.sampleUsers[3]._id,
        rating: 4,
        review: 'Fun racing game with great retro vibes. Multiplayer mode is a blast!'
      }
    ];

    for (const ratingData of ratings) {
      const rating = new Rating(ratingData);
      await rating.save();
    }

    // Update game ratings
    for (const game of this.sampleGames) {
      const gameRatings = await Rating.find({ game: game._id });
      if (gameRatings.length > 0) {
        const average = gameRatings.reduce((sum, r) => sum + r.rating, 0) / gameRatings.length;
        await Game.findByIdAndUpdate(game._id, {
          'publishing.rating.average': Math.round(average * 10) / 10,
          'publishing.rating.count': gameRatings.length
        });
      }
    }

    console.log(`Created ${ratings.length} sample ratings`);
  }

  // Create sample activities
  async createActivities() {
    console.log('Creating sample activities...');

    const activities = [];
    const activityTypes = [
      'game_created', 'game_updated', 'game_published',
      'asset_uploaded', 'collaboration_joined'
    ];

    // Create activities for each user
    for (let i = 0; i < this.sampleUsers.length; i++) {
      const user = this.sampleUsers[i];
      
      // Game creation activities
      const userGames = this.sampleGames.filter(g => g.owner.toString() === user._id.toString());
      for (const game of userGames) {
        activities.push({
          user: user._id,
          type: 'game_created',
          data: {
            gameId: game._id,
            gameName: game.name
          }
        });

        if (game.publishing.status === 'published') {
          activities.push({
            user: user._id,
            type: 'game_published',
            data: {
              gameId: game._id,
              gameName: game.name
            }
          });
        }
      }

      // Asset upload activities
      const userAssets = this.sampleAssets.filter(a => a.owner.toString() === user._id.toString());
      for (const asset of userAssets) {
        activities.push({
          user: user._id,
          type: 'asset_uploaded',
          data: {
            assetId: asset._id,
            assetName: asset.name,
            assetType: asset.type
          }
        });
      }

      // Collaboration activities
      for (const game of this.sampleGames) {
        const isCollaborator = game.collaborators.some(c => c.user.toString() === user._id.toString());
        if (isCollaborator) {
          activities.push({
            user: user._id,
            type: 'collaboration_joined',
            data: {
              gameId: game._id,
              gameName: game.name,
              ownerName: this.sampleUsers.find(u => u._id.toString() === game.owner.toString()).username
            }
          });
        }
      }
    }

    // Add timestamps to make activities look realistic
    const now = new Date();
    activities.forEach((activity, index) => {
      activity.createdAt = new Date(now - (activities.length - index) * 60 * 60 * 1000); // Spread over hours
      activity.updatedAt = activity.createdAt;
    });

    await Activity.insertMany(activities);
    console.log(`Created ${activities.length} sample activities`);
  }

  // Update user usage statistics
  async updateUserUsage() {
    console.log('Updating user usage statistics...');

    for (const user of this.sampleUsers) {
      const userGames = await Game.countDocuments({
        $or: [
          { owner: user._id },
          { 'collaborators.user': user._id }
        ]
      });

      const userAssets = await Asset.find({ owner: user._id });
      const storageUsed = userAssets.reduce((total, asset) => total + asset.size, 0);

      await User.findByIdAndUpdate(user._id, {
        'usage.projectsCreated': userGames,
        'usage.aiRequestsThisMonth': Math.floor(Math.random() * 50), // Random usage
        'usage.storageUsed': storageUsed,
        'usage.collaborationMinutesThisMonth': Math.floor(Math.random() * 300) // Random collaboration time
      });
    }

    console.log('Updated user usage statistics');
  }

  // Add likes to games
  async addGameLikes() {
    console.log('Adding likes to games...');

    for (const game of this.sampleGames) {
      if (game.publishing.status === 'published' || game.publishing.status === 'public') {
        // Randomly assign likes from other users
        const likers = this.sampleUsers
          .filter(u => u._id.toString() !== game.owner.toString())
          .slice(0, Math.floor(Math.random() * 3) + 1); // 1-3 likes

        const likes = likers.map(u => u._id);
        await Game.findByIdAndUpdate(game._id, {
          'publishing.likes': likes
        });
      }
    }

    console.log('Added likes to games');
  }

  // Main seeding function
  async seed(options = {}) {
    try {
      if (options.clear) {
        await this.clearDatabase();
      }

      await this.createUsers();
      await this.createGames();
      await this.createAssets();
      await this.createRatings();
      await this.createActivities();
      await this.updateUserUsage();
      await this.addGameLikes();

      console.log('\n🎉 Database seeding completed successfully!');
      console.log('\nSample accounts created:');
      console.log('- alex@example.com (Pro user, game developer)');
      console.log('- sarah@example.com (Free user, UI designer)');
      console.log('- mike@example.com (Pro user, audio designer)');
      console.log('- lead@example.com (Team user, technical lead)');
      console.log('- indie@example.com (Free user, indie creator)');
      console.log('\nAll passwords: password123');
      console.log('\nSample data includes:');
      console.log(`- ${this.sampleUsers.length} users`);
      console.log(`- ${this.sampleGames.length} games`);
      console.log(`- ${this.sampleAssets.length} assets`);
      console.log('- Ratings and reviews');
      console.log('- User activities');

    } catch (error) {
      console.error('Seeding failed:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const seeder = new DatabaseSeeder();
  
  try {
    await seeder.connect();
    
    const command = process.argv[2];
    const clear = process.argv.includes('--clear');
    
    switch (command) {
      case 'seed':
        await seeder.seed({ clear });
        break;
      case 'clear':
        await seeder.clearDatabase();
        break;
      default:
        console.log('Usage:');
        console.log('  node seed.js seed [--clear]  - Seed database with sample data');
        console.log('  node seed.js clear           - Clear all data');
        process.exit(1);
    }
    
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await seeder.disconnect();
  }
}

// Export for use in other scripts
module.exports = DatabaseSeeder;

// Run if called directly
if (require.main === module) {
  main();
}