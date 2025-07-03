# 🎮 DreamMaker Platform

> **Real-time collaborative game development platform with AI assistance**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/your-org/dreammaker-platform)

DreamMaker is a revolutionary browser-based game development platform that enables real-time collaboration, AI-assisted development, and instant publishing. Think "Google Docs for game development" with professional-grade tools.

## 🌟 Key Features

### 🤝 **Real-time Collaboration**
- Google Docs-style collaborative editing
- Live cursor and selection sharing
- Voice/video chat integration
- Conflict-free operation synchronization (CRDT)

### 🤖 **AI-Powered Development**
- Code generation and completion
- Asset creation with Stability AI
- Game design suggestions
- Performance optimization recommendations

### 🎨 **Professional Tools**
- Advanced Entity-Component-System (ECS) engine
- Visual scripting system for non-programmers
- Comprehensive asset management
- Multi-platform export (Web, Desktop, Mobile)

### 🌐 **Community & Publishing**
- One-click game publishing
- Asset marketplace
- Community-driven development
- Educational institution partnerships

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- Docker and Docker Compose
- MongoDB (local or cloud)
- Redis (local or cloud)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/dreammaker-platform.git
cd dreammaker-platform

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start development environment
npm run dev

# Or with Docker
docker-compose up -d
```

### Environment Configuration

Create `.env` file with required variables:

```env
# Application
NODE_ENV=development
PORT=8080
APP_URL=http://localhost:8080

# Database
MONGODB_URI=mongodb://localhost:27017/dreammaker
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-jwt-secret-key

# AI Services (optional for development)
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
STABILITY_API_KEY=sk-your-stability-key

# Email (optional for development)
SENDGRID_API_KEY=SG.your-sendgrid-key
EMAIL_FROM=noreply@localhost

# Payments (optional for development)
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-key
STRIPE_SECRET_KEY=sk_test_your-stripe-secret
```

### First Run

```bash
# Run database migrations
npm run migrate

# Seed development data
npm run seed:dev

# Start the application
npm start
```

Visit `http://localhost:8080` to access the platform.

## 🏗️ Architecture

### System Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Browser)     │◄──►│   (Node.js)     │◄──►│   (MongoDB)     │
│                 │    │                 │    │                 │
│ • Game Editor   │    │ • REST API      │    │ • User Data     │
│ • Collaboration │    │ • WebSockets    │    │ • Game Projects │
│ • Asset Mgmt    │    │ • AI Integration│    │ • Assets        │
│ • Publishing    │    │ • File Storage  │    │ • Sessions      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                       ┌─────────────────┐
                       │   Redis Cache   │
                       │                 │
                       │ • Sessions      │
                       │ • Rate Limiting │
                       │ • Collaboration │
                       └─────────────────┘
```

### Core Components

- **Engine Core** - Entity-Component-System game engine
- **Collaboration System** - Real-time synchronization with CRDT
- **Visual Editor** - Professional-grade editing tools
- **Asset Manager** - File upload, processing, and optimization
- **AI Integration** - Multiple AI service providers
- **Community Features** - Publishing, sharing, marketplace

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm test               # Run test suite
npm run lint           # Lint code
npm run format         # Format code

# Database
npm run migrate        # Run pending migrations
npm run migrate:create # Create new migration
npm run migrate:status # Check migration status
npm run seed          # Seed database

# Docker
npm run docker:up     # Start with Docker
npm run docker:down   # Stop Docker containers
npm run docker:logs   # View container logs

# Monitoring
npm run health        # Check application health
npm run logs         # View application logs
npm run monitor      # Start monitoring dashboard
```

### Project Structure

```
dreammaker-platform/
├── 📁 public/                    # Frontend application
│   └── index.html               # Main application file
├── 📁 src/                      # Frontend components
│   ├── core/                   # Game engine core
│   ├── collaboration/          # Real-time collaboration
│   ├── editors/               # Visual editors
│   ├── scripting/             # Visual scripting
│   ├── assets/                # Asset management
│   ├── ai/                    # AI integration
│   └── community/             # Community features
├── 📁 server/                   # Backend application
│   ├── server.js              # Main server file
│   ├── api/                   # REST API routes
│   ├── collaboration/         # WebSocket handlers
│   ├── database/              # Database models
│   ├── services/              # Business logic
│   ├── scripts/               # Utility scripts
│   └── migrations/            # Database migrations
├── 📁 docker/                   # Docker configuration
├── 📁 scripts/                  # Deployment scripts
└── 📁 docs/                     # Documentation
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run in watch mode
npm run test:watch
```

### Code Quality

```bash
# Lint and format
npm run lint:fix
npm run format

# Security audit
npm run security:audit

# Performance testing
npm run performance:test
npm run load:test
```

## 🚀 Production Deployment

### Quick Deploy

```bash
# Deploy to production
npm run deploy

# Quick deploy (skip migrations and backups)
npm run deploy:quick

# Force deploy (skip confirmations)
npm run deploy:force

# Rollback to previous version
npm run rollback
```

### Manual Deployment

1. **Prepare Environment**
   ```bash
   # Set up production environment
   cp .env.example .env.production
   # Edit .env.production with production values
   ```

2. **Run Deployment Script**
   ```bash
   sudo ./scripts/deploy.sh
   ```

3. **Verify Deployment**
   ```bash
   npm run health:detailed
   npm run logs
   ```

### Environment Variables (Production)

```env
NODE_ENV=production
PORT=8080
APP_URL=https://dreammaker.dev

# Database (Production)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dreammaker
REDIS_URL=rediss://user:pass@redis-server:6380

# Security
JWT_SECRET=super-secure-64-character-secret
TRUST_PROXY=true

# AI Services
OPENAI_API_KEY=sk-live-your-production-openai-key
ANTHROPIC_API_KEY=sk-ant-your-production-anthropic-key
STABILITY_API_KEY=sk-your-production-stability-key

# Email
SENDGRID_API_KEY=SG.your-production-sendgrid-key
EMAIL_FROM=noreply@dreammaker.dev

# Payments
STRIPE_SECRET_KEY=sk_live_your-production-stripe-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
```

### Infrastructure Requirements

**Minimum Production Setup:**
- 2 CPU cores, 4GB RAM
- 50GB SSD storage
- MongoDB Atlas (M10+ cluster)
- Redis Cloud (30MB+ instance)
- CDN for static assets (CloudFlare)

**Recommended Production Setup:**
- 4 CPU cores, 8GB RAM
- 100GB SSD storage
- Load balancer
- Multi-region deployment
- Automated backups

## 📊 Monitoring & Maintenance

### Health Monitoring

```bash
# Check system health
curl https://dreammaker.dev/health

# Detailed health check
npm run health:detailed

# Monitor logs
npm run logs:app
```

### Database Maintenance

```bash
# Create backup
npm run backup:create

# List backups
npm run backup:list

# Restore from backup
npm run backup:restore <backup-id>

# Run migrations
npm run migrate:up

# Check migration status
npm run migrate:status
```

### Performance Monitoring

- **Application Metrics**: Built-in performance tracking
- **Error Tracking**: Sentry integration
- **Uptime Monitoring**: Health check endpoints
- **Database Monitoring**: MongoDB Atlas monitoring
- **Cache Monitoring**: Redis monitoring

## 🔧 API Documentation

### REST API

The platform provides a comprehensive REST API for all functionality:

- **Authentication**: User registration, login, JWT tokens
- **User Management**: Profiles, settings, subscriptions
- **Game Management**: CRUD operations, collaboration
- **Asset Management**: Upload, processing, optimization
- **AI Services**: Code generation, asset creation
- **Community**: Publishing, ratings, marketplace

Full API documentation: [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)

### WebSocket API

Real-time collaboration is powered by WebSocket connections:

- **Project Collaboration**: Real-time editing, cursors, presence
- **Voice/Video Chat**: WebRTC signaling
- **Live Updates**: Entity changes, system notifications

WebSocket documentation: [WEBSOCKET_DOCUMENTATION.md](docs/WEBSOCKET_DOCUMENTATION.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Standards

- ESLint + Prettier for code formatting
- Jest for testing
- Conventional commits for commit messages
- 80%+ test coverage for new features

## 📈 Roadmap

### Phase 1: Beta Launch (Current)
- ✅ Core engine and collaboration
- ✅ Visual scripting system
- ✅ AI integration
- ✅ Production deployment
- 🔄 Beta user onboarding
- 🔄 Performance optimization

### Phase 2: Public Launch (Q3 2024)
- Advanced collaboration features
- Mobile-responsive interface
- Enhanced AI capabilities
- Community marketplace
- Educational partnerships

### Phase 3: Scale & Growth (Q4 2024)
- Enterprise features
- Plugin ecosystem
- Advanced analytics
- Multi-language support
- VR/AR development tools

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **API Reference**: [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
- **Issues**: [GitHub Issues](https://github.com/your-org/dreammaker-platform/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/dreammaker-platform/discussions)
- **Email**: support@dreammaker.dev

## 🙏 Acknowledgments

- Built with ❤️ by the DreamMaker team
- Inspired by the game development community
- Powered by modern web technologies
- Special thanks to all beta testers and contributors

---

**Ready to change the future of game development? [Get started today!](https://dreammaker.dev)** 🚀