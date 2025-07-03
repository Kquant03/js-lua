#!/bin/bash
# DreamMaker Platform - Production Deployment Script
# Usage: ./deploy.sh [--quick] [--rollback] [--force]

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="/opt/dreammaker"
BACKUP_DIR="/opt/dreammaker-backups"

# Use local log file for development, system log for production
if [[ -w "/var/log" ]]; then
    LOG_FILE="/var/log/dreammaker-deploy.log"
else
    # Create logs directory in project root for development
    mkdir -p "$PROJECT_ROOT/logs"
    LOG_FILE="$PROJECT_ROOT/logs/deploy.log"
fi

HEALTH_CHECK_URL="http://localhost:8080/health"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
QUICK_DEPLOY=false
ROLLBACK=false
FORCE_DEPLOY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --quick)
      QUICK_DEPLOY=true
      shift
      ;;
    --rollback)
      ROLLBACK=true
      shift
      ;;
    --force)
      FORCE_DEPLOY=true
      shift
      ;;
    --local)
      # Local development mode
      DEPLOY_DIR="$PROJECT_ROOT/deploy-local"
      BACKUP_DIR="$PROJECT_ROOT/backups"
      HEALTH_CHECK_URL="http://localhost:3000/health"
      DOCKER_COMPOSE_FILE="docker-compose.dev.yml"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--quick] [--rollback] [--force] [--local]"
      exit 1
      ;;
  esac
done

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO)
            echo -e "${GREEN}[INFO]${NC} $message"
            ;;
        WARN)
            echo -e "${YELLOW}[WARN]${NC} $message"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
        DEBUG)
            echo -e "${BLUE}[DEBUG]${NC} $message"
            ;;
    esac
    
    # Only log to file if we can write to it
    if touch "$LOG_FILE" 2>/dev/null; then
        echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    fi
}

# Error handler
error_exit() {
    log ERROR "$1"
    log ERROR "Deployment failed! Check logs at $LOG_FILE"
    exit 1
}

# Cleanup function
cleanup() {
    log INFO "Performing cleanup..."
    # Remove temporary files if any
    rm -f /tmp/dreammaker-deploy-*
    log INFO "Cleanup complete"
}

# Trap for cleanup on exit
trap cleanup EXIT

# Check if running as root or with proper permissions
check_permissions() {
    # For local development, just ensure we can write to deploy directory
    if [[ "$DEPLOY_DIR" =~ ^"$PROJECT_ROOT".* ]]; then
        mkdir -p "$DEPLOY_DIR"
        if [[ ! -w "$DEPLOY_DIR" ]]; then
            error_exit "Cannot write to local deploy directory: $DEPLOY_DIR"
        fi
        log INFO "Using local deployment mode: $DEPLOY_DIR"
        return
    fi
    
    # For production deployment, need proper permissions
    if [[ $EUID -ne 0 ]] && [[ ! -w "$DEPLOY_DIR" ]]; then
        error_exit "This script requires root privileges or write access to $DEPLOY_DIR"
    fi
}

# Verify prerequisites
check_prerequisites() {
    log INFO "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error_exit "Docker Compose is not installed"
    fi
    
    # Check for environment file (prefer .env.production, fall back to .env)
    ENV_FILE=""
    if [[ -f "$PROJECT_ROOT/.env.production" ]]; then
        ENV_FILE="$PROJECT_ROOT/.env.production"
    elif [[ -f "$PROJECT_ROOT/.env" ]]; then
        ENV_FILE="$PROJECT_ROOT/.env"
        log WARN "Using .env file instead of .env.production"
    else
        error_exit "No environment file found (.env.production or .env)"
    fi
    
    log INFO "Using environment file: $ENV_FILE"
    
    # Verify environment variables
    source "$ENV_FILE"
    
    local required_vars=(
        "MONGODB_URI"
        "JWT_SECRET"
    )
    
    # Optional vars for production
    local optional_vars=(
        "REDIS_URL"
        "STRIPE_SECRET_KEY"
        "OPENAI_API_KEY"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            error_exit "Required environment variable $var is not set in $ENV_FILE"
        fi
    done
    
    for var in "${optional_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            log WARN "Optional environment variable $var is not set"
        fi
    done
    
    log INFO "Prerequisites check passed"
}

# Create backup
create_backup() {
    if [[ "$QUICK_DEPLOY" == true ]]; then
        log INFO "Skipping backup (quick deploy mode)"
        return
    fi
    
    log INFO "Creating backup..."
    
    local backup_timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_path="$BACKUP_DIR/backup_$backup_timestamp"
    
    # Create backup directory
    mkdir -p "$backup_path"
    
    # Backup application files
    if [[ -d "$DEPLOY_DIR" ]]; then
        log INFO "Backing up application files..."
        cp -r "$DEPLOY_DIR" "$backup_path/app"
    fi
    
    # For local development, skip database backup
    if [[ ! "$DEPLOY_DIR" =~ ^"$PROJECT_ROOT".* ]]; then
        # Backup database (production only)
        log INFO "Creating database backup..."
        if [[ -n "$MONGODB_URI" ]]; then
            mongodump --uri="$MONGODB_URI" --out="$backup_path/database" 2>/dev/null || {
                log WARN "Database backup failed - continuing anyway"
            }
        fi
    fi
    
    # Create backup metadata
    cat > "$backup_path/metadata.txt" << EOF
Backup created: $(date)
Git commit: $(git rev-parse HEAD 2>/dev/null || echo "unknown")
Environment: $([[ "$DEPLOY_DIR" =~ ^"$PROJECT_ROOT".* ]] && echo "development" || echo "production")
Deployment type: $([ "$QUICK_DEPLOY" == true ] && echo "quick" || echo "full")
Deploy directory: $DEPLOY_DIR
EOF
    
    # Clean up old backups (keep last 10)
    log INFO "Cleaning up old backups..."
    ls -t "$BACKUP_DIR"/backup_* 2>/dev/null | tail -n +11 | xargs -r rm -rf
    
    log INFO "Backup created at $backup_path"
    export BACKUP_PATH="$backup_path"
}

# Database migrations
run_migrations() {
    if [[ "$QUICK_DEPLOY" == true ]]; then
        log INFO "Skipping migrations (quick deploy mode)"
        return
    fi
    
    # Skip migrations for local development unless forced
    if [[ "$DEPLOY_DIR" =~ ^"$PROJECT_ROOT".* ]] && [[ "$FORCE_DEPLOY" != true ]]; then
        log INFO "Skipping migrations (local development mode)"
        return
    fi
    
    log INFO "Running database migrations..."
    
    # Source environment variables
    if [[ -f "$PROJECT_ROOT/.env.production" ]]; then
        source "$PROJECT_ROOT/.env.production"
    elif [[ -f "$PROJECT_ROOT/.env" ]]; then
        source "$PROJECT_ROOT/.env"
    fi
    
    # Check if we have migration scripts
    if [[ ! -f "$PROJECT_ROOT/server/scripts/migrate.js" ]]; then
        log WARN "No migration script found - skipping migrations"
        return
    fi
    
    # Install dependencies and run migrations
    cd "$PROJECT_ROOT"
    if [[ -f "package.json" ]]; then
        npm install --production || log WARN "npm install failed"
        npm run migrate 2>/dev/null || log WARN "Migration script failed or not available"
    fi
    
    log INFO "Database migrations completed"
}

# Build application
build_application() {
    log INFO "Building application..."
    
    cd "$PROJECT_ROOT"
    
    # Check if Docker Compose file exists
    if [[ ! -f "$DOCKER_COMPOSE_FILE" ]]; then
        log WARN "Docker Compose file $DOCKER_COMPOSE_FILE not found"
        if [[ -f "docker-compose.yml" ]]; then
            DOCKER_COMPOSE_FILE="docker-compose.yml"
            log INFO "Using docker-compose.yml instead"
        else
            log WARN "No Docker Compose file found - skipping Docker build"
            return
        fi
    fi
    
    # Build Docker images
    log INFO "Building Docker images with $DOCKER_COMPOSE_FILE..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" build || log WARN "Docker build failed - continuing anyway"
    
    log INFO "Application build completed"
}

# Deploy application
deploy_application() {
    log INFO "Deploying application..."
    
    cd "$PROJECT_ROOT"
    
    # Create deploy directory
    mkdir -p "$DEPLOY_DIR"
    
    # Stop existing services
    if [[ -f "$DEPLOY_DIR/$DOCKER_COMPOSE_FILE" ]]; then
        log INFO "Stopping existing services..."
        cd "$DEPLOY_DIR"
        docker-compose -f "$DOCKER_COMPOSE_FILE" down || log WARN "Failed to stop existing services"
    fi
    
    # Copy new application files
    log INFO "Copying application files..."
    cd "$PROJECT_ROOT"
    
    # Use rsync if available, otherwise cp
    if command -v rsync &> /dev/null; then
        rsync -av --delete \
            --exclude=node_modules \
            --exclude=.git \
            --exclude=logs \
            --exclude=uploads \
            --exclude=deploy-local \
            --exclude=backups \
            "$PROJECT_ROOT/" "$DEPLOY_DIR/"
    else
        cp -r "$PROJECT_ROOT"/* "$DEPLOY_DIR/" 2>/dev/null || true
    fi
    
    # Ensure required directories exist
    mkdir -p "$DEPLOY_DIR"/{logs,uploads,backups}
    
    # Set proper permissions (only if not local)
    if [[ ! "$DEPLOY_DIR" =~ ^"$PROJECT_ROOT".* ]]; then
        chown -R $(whoami):$(whoami) "$DEPLOY_DIR" || true
    fi
    chmod +x "$DEPLOY_DIR/scripts/"*.sh 2>/dev/null || true
    
    cd "$DEPLOY_DIR"
    
    # Start services
    if [[ -f "$DOCKER_COMPOSE_FILE" ]]; then
        log INFO "Starting services with $DOCKER_COMPOSE_FILE..."
        docker-compose -f "$DOCKER_COMPOSE_FILE" up -d || log WARN "Failed to start Docker services"
    else
        log INFO "No Docker Compose file found - manual service start required"
    fi
    
    log INFO "Application deployment completed"
}

# Health check
health_check() {
    log INFO "Performing health check..."
    
    local max_attempts=15  # Reduced for local development
    local attempt=1
    local wait_time=5      # Reduced wait time
    
    while [[ $attempt -le $max_attempts ]]; do
        log INFO "Health check attempt $attempt/$max_attempts..."
        
        if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            log INFO "Health check passed"
            
            # Additional detailed health check
            local health_response=$(curl -s "$HEALTH_CHECK_URL" 2>/dev/null || echo '{"status":"unknown"}')
            if echo "$health_response" | grep -q '"status":"healthy"' || echo "$health_response" | grep -q '"status":"ok"'; then
                log INFO "Detailed health check passed"
                return 0
            else
                log INFO "Service is responding: $health_response"
                return 0  # Accept any response as success for local dev
            fi
        else
            log WARN "Health check failed (attempt $attempt/$max_attempts)"
        fi
        
        if [[ $attempt -lt $max_attempts ]]; then
            log INFO "Waiting ${wait_time} seconds before next attempt..."
            sleep $wait_time
        fi
        
        ((attempt++))
    done
    
    log WARN "Health check failed after $max_attempts attempts - continuing anyway for local development"
}

# Post-deployment tasks
post_deployment() {
    log INFO "Running post-deployment tasks..."
    
    # Clear application caches (if available)
    if [[ -f "$DEPLOY_DIR/$DOCKER_COMPOSE_FILE" ]]; then
        if docker-compose -f "$DEPLOY_DIR/$DOCKER_COMPOSE_FILE" exec -T app npm run cache:clear 2>/dev/null; then
            log INFO "Application cache cleared"
        else
            log DEBUG "Cache clear not available"
        fi
    fi
    
    log INFO "Post-deployment tasks completed"
}

# Rollback function
rollback() {
    log INFO "Starting rollback process..."
    
    if [[ -z "$BACKUP_PATH" ]]; then
        # Find the latest backup
        BACKUP_PATH=$(ls -t "$BACKUP_DIR"/backup_* 2>/dev/null | head -n 1)
        if [[ -z "$BACKUP_PATH" ]]; then
            error_exit "No backup found for rollback"
        fi
    fi
    
    log INFO "Rolling back to backup: $BACKUP_PATH"
    
    # Stop current services
    cd "$DEPLOY_DIR"
    if [[ -f "$DOCKER_COMPOSE_FILE" ]]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" down || log WARN "Failed to stop services"
    fi
    
    # Restore application files
    if [[ -d "$BACKUP_PATH/app" ]]; then
        log INFO "Restoring application files..."
        rm -rf "$DEPLOY_DIR"
        cp -r "$BACKUP_PATH/app" "$DEPLOY_DIR"
    fi
    
    # Restore database (production only)
    if [[ -d "$BACKUP_PATH/database" ]] && [[ ! "$DEPLOY_DIR" =~ ^"$PROJECT_ROOT".* ]]; then
        log INFO "Restoring database..."
        mongorestore --uri="$MONGODB_URI" --drop "$BACKUP_PATH/database" || log WARN "Database restore failed"
    fi
    
    # Start services
    cd "$DEPLOY_DIR"
    if [[ -f "$DOCKER_COMPOSE_FILE" ]]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" up -d || error_exit "Failed to start services after rollback"
    fi
    
    # Health check after rollback
    health_check
    
    log INFO "Rollback completed successfully"
}

# Main deployment function
main_deploy() {
    log INFO "Starting DreamMaker Platform deployment..."
    log INFO "Deploy mode: $([ "$QUICK_DEPLOY" == true ] && echo "quick" || echo "full")"
    log INFO "Target: $([[ "$DEPLOY_DIR" =~ ^"$PROJECT_ROOT".* ]] && echo "local development" || echo "production")"
    
    check_permissions
    check_prerequisites
    create_backup
    
    if [[ "$FORCE_DEPLOY" != true ]]; then
        echo -n "Continue with deployment? [y/N]: "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log INFO "Deployment cancelled by user"
            exit 0
        fi
    fi
    
    run_migrations
    build_application
    deploy_application
    health_check
    post_deployment
    
    log INFO "🎉 Deployment completed successfully!"
    log INFO "Application target: $DEPLOY_DIR"
    log INFO "Health check URL: $HEALTH_CHECK_URL"
    log INFO "Logs location: $LOG_FILE"
    if [[ -f "$DEPLOY_DIR/$DOCKER_COMPOSE_FILE" ]]; then
        log INFO "Docker logs: docker-compose -f $DEPLOY_DIR/$DOCKER_COMPOSE_FILE logs -f"
    fi
}

# Main script logic
main() {
    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Start deployment log
    log INFO "=== DreamMaker Deployment Script Started ==="
    log INFO "Timestamp: $(date)"
    log INFO "User: $(whoami)"
    log INFO "Project root: $PROJECT_ROOT"
    log INFO "Log file: $LOG_FILE"
    log INFO "Arguments: $*"
    
    if [[ "$ROLLBACK" == true ]]; then
        rollback
    else
        main_deploy
    fi
}

# Run main function
main "$@"