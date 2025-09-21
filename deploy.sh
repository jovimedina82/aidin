#!/bin/bash

# IT Helpdesk Platform Docker Deployment Script
echo "🏥 IT Helpdesk Platform - Docker Deployment"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_status "Checking Docker daemon..."
if ! docker info &> /dev/null; then
    print_error "Docker daemon is not running. Please start Docker first."
    exit 1
fi

print_success "Docker is ready!"

# Stop any existing containers
print_status "Stopping any existing containers..."
docker-compose down

# Remove old images if they exist
print_status "Cleaning up old images..."
docker image prune -f

# Build and start the containers
print_status "Building and starting IT Helpdesk Platform..."
docker-compose up --build -d

# Wait for containers to be ready
print_status "Waiting for containers to be ready..."
sleep 30

# Check container status
print_status "Checking container status..."
if docker-compose ps | grep -q "Up"; then
    print_success "Containers are running!"
else
    print_error "Containers failed to start. Checking logs..."
    docker-compose logs
    exit 1
fi

# Initialize database
print_status "Initializing database..."
docker-compose exec helpdesk-app /bin/sh -c "
    mkdir -p /app/data
    npx prisma migrate deploy
    npx prisma db seed || echo 'Seed data already exists'
"

# Display status
echo ""
echo "🎉 IT Helpdesk Platform deployed successfully!"
echo "=============================================="
echo ""
print_success "Application URL: http://localhost:3000"
echo ""
echo "📋 Default Test Accounts:"
echo "  👨‍💼 Admin: admin@surterreproperties.com / admin123"
echo "  🛠️  Staff: staff@surterreproperties.com / admin123"
echo "  👤 User:  user@surterreproperties.com / admin123"
echo ""
echo "🔧 Management Commands:"
echo "  • View logs:        docker-compose logs -f"
echo "  • Stop platform:    docker-compose down"
echo "  • Restart:          docker-compose restart"
echo "  • Update:           docker-compose pull && docker-compose up -d"
echo ""
echo "📊 Container Status:"
docker-compose ps

# Optional: Open browser
if command -v open &> /dev/null; then
    read -p "Would you like to open the application in your browser? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open http://localhost:3000
    fi
elif command -v xdg-open &> /dev/null; then
    read -p "Would you like to open the application in your browser? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        xdg-open http://localhost:3000
    fi
fi

echo ""
print_success "Deployment complete! 🚀"
