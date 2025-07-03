#!/bin/bash

# ===========================================
# DreamMaker Platform Setup Script
# ===========================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "========================================"
    echo "🎮 DreamMaker Platform Setup"
    echo "========================================"
    echo -e "${NC}"
}

print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Generate random secret
generate_secret() {
    if command_exists openssl; then
        openssl rand -hex 32
    else
        # Fallback for systems without openssl
        head /dev/urandom | tr -dc A-Za-z0-9 | head -c 64
    fi
}

# Main setup function
main() {
    print_header
    
    echo "This script will set up your DreamMaker development environment."
    echo "Make sure you have the following installed:"
    echo "  - Node.js (v18+)"
    echo "  - MongoDB (local or cloud)"
    echo "  - Redis (optional, for caching)"
    echo "  - Docker (optional, for containerized setup)"
    echo ""
    
    read -p "Continue with setup? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 1
    fi
    
    # Check prerequisites
    print_step "Checking prerequisites..."
    
    if ! command_exists node; then
        print_error "Node.js is not installed. Please install Node.js v18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ required. Current version: $(node --version)"
        exit 1
    fi
    
    if ! command_exists npm; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
    
    # Install dependencies
    print_step "Installing Node.js dependencies..."
    
    if [ -f "package.json" ]; then
        npm install
        print_success "Dependencies installed"
    else
        print_error "package.json not found. Run this script from the project root."
        exit 1
    fi
    
    # Create environment file
    print_step "Setting up environment configuration..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Created .env file from template"
        else
            print_error ".env.example file not found"
            exit 1
        fi
    else
        print_warning ".env file already exists. Skipping creation."
    fi
    
    # Generate JWT secret
    print_step "Generating JWT secret..."
    JWT_SECRET=$(generate_secret)
    
    # Update .env file with generated secrets
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your-super-secret-jwt-key-minimum-32-characters/$JWT_SECRET/g" .env
        sed -i '' "s/your-super-secret-session-key-here/$(generate_secret)/g" .env
    else
        # Linux
        sed -i "s/your-super-secret-jwt-key-minimum-32-characters/$JWT_SECRET/g" .env
        sed -i "s/your-super-secret-session-key-here/$(generate_secret)/g" .env
    fi
    
    print_success "Generated secure secrets"
    
    # Create required directories
    print_step "Creating required directories..."
    
    mkdir -p uploads
    mkdir -p logs
    mkdir -p backups
    mkdir -p temp
    
    print_success "Directories created"
    
    # Check database connection
    print_step "Checking database configuration..."
    
    echo "Database setup options:"
    echo "  1. Use local MongoDB (default)"
    echo "  2. Use MongoDB Atlas (cloud)"
    echo "  3. Skip database setup"
    echo ""
    read -p "Choose option (1-3): " -n 1 -r DB_OPTION
    echo
    
    case $DB_OPTION in
        1)
            if command_exists mongod; then
                print_success "Local MongoDB detected"
                echo "Using local MongoDB at mongodb://localhost:27017/dreammaker"
            else
                print_warning "MongoDB not found locally. Please install MongoDB or use Atlas."
                echo "MongoDB installation: https://docs.mongodb.com/manual/installation/"
            fi
            ;;
        2)
            echo ""
            echo "MongoDB Atlas setup:"
            echo "1. Go to https://cloud.mongodb.com"
            echo "2. Create a free cluster"
            echo "3. Get your connection string"
            echo "4. Update MONGODB_URI in .env file"
            print_warning "Please update MONGODB_URI in .env file with your Atlas connection string"
            ;;
        3)
            print_warning "Database setup skipped. Update MONGODB_URI in .env file later."
            ;;
        *)
            print_warning "Invalid option. Using local MongoDB as default."
            ;;
    esac
    
    # Redis setup
    print_step "Checking Redis configuration..."
    
    if command_exists redis-server; then
        print_success "Redis detected locally"
    else
        print_warning "Redis not found. Session management will use memory store."
        echo "Redis installation: https://redis.io/download"
    fi
    
    # API Keys setup
    print_step "Setting up API keys..."
    
    echo ""
    echo "You'll need to set up the following API keys in .env file:"
    echo ""
    echo "🤖 AI Services (choose one or more):"
    echo "  - OpenAI: https://platform.openai.com/api-keys"
    echo "  - Anthropic: https://console.anthropic.com/"
    echo "  - Stability AI: https://platform.stability.ai/"
    echo ""
    echo "💳 Payment Processing:"
    echo "  - Stripe: https://dashboard.stripe.com/apikeys"
    echo ""
    echo "📧 Email Service (choose one):"
    echo "  - SendGrid: https://app.sendgrid.com/settings/api_keys"
    echo "  - Or configure SMTP settings"
    echo ""
    
    read -p "Open .env file for editing now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if command_exists code; then
            code .env
        elif command_exists nano; then
            nano .env
        elif command_exists vim; then
            vim .env
        else
            print_warning "No suitable editor found. Please edit .env manually."
        fi
    fi
    
    # Docker setup (optional)
    print_step "Docker setup (optional)..."
    
    if command_exists docker && command_exists docker-compose; then
        echo ""
        echo "Docker detected. You can use Docker for development:"
        echo "  - docker-compose up -d    (start services)"
        echo "  - docker-compose down     (stop services)"
        echo "  - docker-compose logs     (view logs)"
        echo ""
        read -p "Start with Docker now? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if [ -f "docker-compose.yml" ]; then
                docker-compose up -d
                print_success "Docker services started"
            else
                print_error "docker-compose.yml not found"
            fi
        fi
    else
        print_warning "Docker not found. You can install it later for containerized development."
    fi
    
    # Database initialization
    print_step "Database initialization..."
    
    echo ""
    read -p "Initialize database with sample data? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f "server/scripts/seed.js" ]; then
            npm run seed
            print_success "Database seeded with sample data"
        else
            print_warning "Seed script not found. Database will be empty."
        fi
    fi
    
    # Final setup
    print_step "Final setup..."
    
    # Create a simple package.json scripts if not exists
    if ! grep -q "\"dev\":" package.json; then
        print_warning "Adding development scripts to package.json..."
        # This would need to be implemented based on your package.json structure
    fi
    
    # Setup complete
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}🎉 Setup Complete!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Update API keys in .env file:"
    echo "   - Add your AI service API keys"
    echo "   - Configure email service (SendGrid or SMTP)"
    echo "   - Set up Stripe for payments"
    echo ""
    echo "2. Start the development server:"
    echo "   npm run dev"
    echo ""
    echo "3. Visit your application:"
    echo "   http://localhost:8080"
    echo ""
    echo "4. Create your first game and start building!"
    echo ""
    echo "Need help? Check out the documentation:"
    echo "  - README.md"
    echo "  - docs/API_DOCUMENTATION.md"
    echo "  - docs/WEBSOCKET_DOCUMENTATION.md"
    echo ""
    echo "Happy game development! 🎮✨"
    echo ""
}

# Run setup if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi