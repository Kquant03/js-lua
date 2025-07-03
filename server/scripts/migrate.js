// server/scripts/migrate.js
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

class MigrationRunner {
  constructor() {
    this.migrationsDir = path.join(__dirname, '../migrations');
    this.migrationSchema = new mongoose.Schema({
      version: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      executedAt: { type: Date, default: Date.now },
      executionTime: { type: Number }, // milliseconds
      checksum: { type: String, required: true }
    });
    
    this.Migration = mongoose.model('Migration', this.migrationSchema);
  }

  async initialize() {
    // Connect to database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database for migrations');

    // Ensure migrations directory exists
    try {
      await fs.access(this.migrationsDir);
    } catch (error) {
      await fs.mkdir(this.migrationsDir, { recursive: true });
      console.log(`📁 Created migrations directory: ${this.migrationsDir}`);
    }

    // Create indexes for migration tracking
    await this.Migration.collection.createIndex({ version: 1 }, { unique: true });
  }

  async getExecutedMigrations() {
    return await this.Migration.find({}).sort({ version: 1 });
  }

  async getPendingMigrations() {
    const executedMigrations = await this.getExecutedMigrations();
    const executedVersions = new Set(executedMigrations.map(m => m.version));

    // Read all migration files
    const files = await fs.readdir(this.migrationsDir);
    const migrationFiles = files
      .filter(file => file.endsWith('.js'))
      .sort();

    const pendingMigrations = [];

    for (const file of migrationFiles) {
      const version = this.extractVersionFromFilename(file);
      if (!executedVersions.has(version)) {
        const filePath = path.join(this.migrationsDir, file);
        const checksum = await this.calculateChecksum(filePath);
        
        pendingMigrations.push({
          version,
          name: this.extractNameFromFilename(file),
          filename: file,
          path: filePath,
          checksum
        });
      }
    }

    return pendingMigrations;
  }

  extractVersionFromFilename(filename) {
    // Extract version from filename like: "001_create_users_index.js"
    const match = filename.match(/^(\d+)_/);
    return match ? match[1] : filename;
  }

  extractNameFromFilename(filename) {
    // Extract name from filename: "001_create_users_index.js" -> "create_users_index"
    return filename.replace(/^\d+_/, '').replace(/\.js$/, '');
  }

  async calculateChecksum(filePath) {
    const crypto = require('crypto');
    const content = await fs.readFile(filePath, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  async executeMigration(migration) {
    console.log(`📊 Executing migration: ${migration.version} - ${migration.name}`);
    
    const startTime = Date.now();
    
    try {
      // Load the migration module
      const migrationModule = require(migration.path);
      
      if (typeof migrationModule.up !== 'function') {
        throw new Error(`Migration ${migration.filename} must export an 'up' function`);
      }

      // Execute the migration
      await migrationModule.up(mongoose.connection.db, mongoose);
      
      const executionTime = Date.now() - startTime;

      // Record successful execution
      await this.Migration.create({
        version: migration.version,
        name: migration.name,
        executionTime,
        checksum: migration.checksum
      });

      console.log(`✅ Migration ${migration.version} completed in ${executionTime}ms`);
      
      return { success: true, executionTime };
    } catch (error) {
      console.error(`❌ Migration ${migration.version} failed:`, error.message);
      throw error;
    }
  }

  async rollbackMigration(version) {
    console.log(`🔄 Rolling back migration: ${version}`);
    
    // Find the migration record
    const migrationRecord = await this.Migration.findOne({ version });
    if (!migrationRecord) {
      throw new Error(`Migration ${version} not found in database`);
    }

    // Find the migration file
    const files = await fs.readdir(this.migrationsDir);
    const migrationFile = files.find(file => 
      this.extractVersionFromFilename(file) === version
    );

    if (!migrationFile) {
      throw new Error(`Migration file for version ${version} not found`);
    }

    const migrationPath = path.join(this.migrationsDir, migrationFile);
    const migrationModule = require(migrationPath);

    if (typeof migrationModule.down !== 'function') {
      throw new Error(`Migration ${migrationFile} must export a 'down' function for rollback`);
    }

    try {
      // Execute rollback
      await migrationModule.down(mongoose.connection.db, mongoose);
      
      // Remove migration record
      await this.Migration.deleteOne({ version });
      
      console.log(`✅ Migration ${version} rolled back successfully`);
      
      return { success: true };
    } catch (error) {
      console.error(`❌ Rollback of migration ${version} failed:`, error.message);
      throw error;
    }
  }

  async runPendingMigrations() {
    const pendingMigrations = await this.getPendingMigrations();
    
    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📊 Found ${pendingMigrations.length} pending migrations`);
    
    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }

    console.log('🎉 All migrations completed successfully');
  }

  async createMigration(name) {
    if (!name) {
      throw new Error('Migration name is required');
    }

    // Generate version number (timestamp-based)
    const version = Date.now().toString();
    const filename = `${version}_${name.toLowerCase().replace(/\s+/g, '_')}.js`;
    const filePath = path.join(this.migrationsDir, filename);

    const template = `// Migration: ${name}
// Created: ${new Date().toISOString()}

module.exports = {
  async up(db, mongoose) {
    // Write your migration logic here
    console.log('Executing migration: ${name}');
    
    // Example: Create an index
    // await db.collection('users').createIndex({ email: 1 }, { unique: true });
    
    // Example: Update documents
    // await db.collection('users').updateMany(
    //   { role: { $exists: false } },
    //   { $set: { role: 'user' } }
    // );
    
    // Example: Create a new collection
    // await db.createCollection('newCollection', {
    //   validator: {
    //     $jsonSchema: {
    //       bsonType: 'object',
    //       required: ['name'],
    //       properties: {
    //         name: { bsonType: 'string' }
    //       }
    //     }
    //   }
    // });
  },

  async down(db, mongoose) {
    // Write your rollback logic here
    console.log('Rolling back migration: ${name}');
    
    // Rollback the changes made in the up() function
    // Example: Drop an index
    // await db.collection('users').dropIndex({ email: 1 });
    
    // Example: Revert document updates
    // await db.collection('users').updateMany(
    //   { role: 'user' },
    //   { $unset: { role: 1 } }
    // );
    
    // Example: Drop a collection
    // await db.collection('newCollection').drop();
  }
};
`;

    await fs.writeFile(filePath, template);
    console.log(`📝 Created migration: ${filename}`);
    console.log(`📍 Path: ${filePath}`);
    
    return { filename, path: filePath };
  }

  async getStatus() {
    const executed = await this.getExecutedMigrations();
    const pending = await this.getPendingMigrations();
    
    return {
      executed: executed.map(m => ({
        version: m.version,
        name: m.name,
        executedAt: m.executedAt,
        executionTime: m.executionTime
      })),
      pending: pending.map(m => ({
        version: m.version,
        name: m.name,
        filename: m.filename
      })),
      summary: {
        totalExecuted: executed.length,
        totalPending: pending.length,
        lastExecuted: executed.length > 0 ? executed[executed.length - 1] : null
      }
    };
  }

  async validateMigrationIntegrity() {
    console.log('🔍 Validating migration integrity...');
    
    const executed = await this.getExecutedMigrations();
    let issues = [];

    for (const migration of executed) {
      try {
        // Check if migration file still exists
        const files = await fs.readdir(this.migrationsDir);
        const migrationFile = files.find(file => 
          this.extractVersionFromFilename(file) === migration.version
        );

        if (!migrationFile) {
          issues.push({
            type: 'missing_file',
            version: migration.version,
            message: `Migration file for version ${migration.version} is missing`
          });
          continue;
        }

        // Check checksum
        const filePath = path.join(this.migrationsDir, migrationFile);
        const currentChecksum = await this.calculateChecksum(filePath);
        
        if (currentChecksum !== migration.checksum) {
          issues.push({
            type: 'checksum_mismatch',
            version: migration.version,
            message: `Migration file ${migrationFile} has been modified after execution`
          });
        }
      } catch (error) {
        issues.push({
          type: 'validation_error',
          version: migration.version,
          message: error.message
        });
      }
    }

    if (issues.length === 0) {
      console.log('✅ Migration integrity check passed');
    } else {
      console.log(`⚠️ Found ${issues.length} integrity issues:`);
      issues.forEach(issue => {
        console.log(`  - ${issue.type}: ${issue.message}`);
      });
    }

    return issues;
  }

  async close() {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const migrationRunner = new MigrationRunner();

  try {
    await migrationRunner.initialize();

    switch (command) {
      case 'up':
      case 'migrate':
        await migrationRunner.runPendingMigrations();
        break;

      case 'down':
      case 'rollback':
        const version = args[1];
        if (!version) {
          console.error('❌ Version required for rollback');
          console.log('Usage: npm run migrate rollback <version>');
          process.exit(1);
        }
        await migrationRunner.rollbackMigration(version);
        break;

      case 'create':
        const name = args.slice(1).join(' ');
        if (!name) {
          console.error('❌ Migration name required');
          console.log('Usage: npm run migrate create <migration_name>');
          process.exit(1);
        }
        await migrationRunner.createMigration(name);
        break;

      case 'status':
        const status = await migrationRunner.getStatus();
        console.log('\n📊 Migration Status:');
        console.log(`Executed: ${status.summary.totalExecuted}`);
        console.log(`Pending: ${status.summary.totalPending}`);
        
        if (status.summary.lastExecuted) {
          console.log(`Last executed: ${status.summary.lastExecuted.name} (${status.summary.lastExecuted.executedAt})`);
        }

        if (status.pending.length > 0) {
          console.log('\n📋 Pending migrations:');
          status.pending.forEach(m => {
            console.log(`  - ${m.version}: ${m.name}`);
          });
        }

        if (status.executed.length > 0) {
          console.log('\n✅ Executed migrations:');
          status.executed.forEach(m => {
            console.log(`  - ${m.version}: ${m.name} (${m.executionTime}ms)`);
          });
        }
        break;

      case 'validate':
        await migrationRunner.validateMigrationIntegrity();
        break;

      default:
        console.log('DreamMaker Migration Runner');
        console.log('');
        console.log('Commands:');
        console.log('  migrate, up          - Run pending migrations');
        console.log('  rollback, down <ver> - Rollback specific migration');
        console.log('  create <name>        - Create new migration');
        console.log('  status               - Show migration status');
        console.log('  validate             - Validate migration integrity');
        console.log('');
        console.log('Examples:');
        console.log('  npm run migrate');
        console.log('  npm run migrate create "add user email index"');
        console.log('  npm run migrate rollback 1640995200000');
        console.log('  npm run migrate status');
        break;
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await migrationRunner.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = MigrationRunner;