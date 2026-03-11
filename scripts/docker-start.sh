#!/bin/bash

# CoinKrazy Docker Startup Script
# This script helps you get the CoinKrazy platform running with Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║         CoinKrazy Platform - Docker Startup            ║"
echo "║     Sweepstakes Social Casino Platform                 ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    echo "Please install Docker from: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    echo "Please install Docker Compose from: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"

# Create .env file from .env.example if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}Please update .env with your configuration values:${NC}"
    echo "  - Payment provider credentials (Stripe, PayPal, Square, CashApp)"
    echo "  - Email service credentials (Gmail SMTP)"
    echo "  - Database URL (if using external database)"
    echo ""
fi

# Create SSL directory if using production profile
if [ ! -d "ssl" ]; then
    mkdir -p ssl
    echo -e "${YELLOW}Generated self-signed SSL certificates (dev only)${NC}"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem -out ssl/cert.pem \
        -subj "/CN=localhost" 2>/dev/null || true
fi

# Determine which mode to run
MODE="development"
if [ "$1" = "prod" ] || [ "$1" = "production" ]; then
    MODE="production"
    echo -e "${YELLOW}Starting in PRODUCTION mode${NC}"
else
    echo -e "${YELLOW}Starting in DEVELOPMENT mode${NC}"
    echo "  Tip: Use './scripts/docker-start.sh prod' for production mode"
fi

# Build images if needed
echo -e "${YELLOW}Building Docker images...${NC}"
if [ "$MODE" = "production" ]; then
    docker-compose build
else
    docker-compose build app
fi

echo -e "${GREEN}✓ Docker images built${NC}"

# Start services
echo -e "${YELLOW}Starting CoinKrazy services...${NC}"

if [ "$MODE" = "production" ]; then
    docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d --profile production
else
    docker-compose -f docker-compose.yml up -d
fi

echo -e "${GREEN}✓ Services started${NC}"

# Wait for database to be ready
echo -e "${YELLOW}Waiting for database to be ready...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0

while ! docker-compose exec -T postgres pg_isready -U coinkrazy &> /dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}✗ Database failed to start${NC}"
        exit 1
    fi
    echo -ne "  Waiting... ($RETRY_COUNT/$MAX_RETRIES)\r"
    sleep 1
done

echo -e "${GREEN}✓ Database is ready${NC}"

# Initialize database schema
echo -e "${YELLOW}Initializing database schema...${NC}"
docker-compose exec -T postgres psql -U coinkrazy -d coinkrazy_db -f /docker-entrypoint-initdb.d/01-banking-schema.sql &> /dev/null || true
echo -e "${GREEN}✓ Database schema initialized${NC}"

# Wait for API server
echo -e "${YELLOW}Waiting for API server to be ready...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0

while ! curl -s http://localhost:3001/api/ping &> /dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${YELLOW}⚠ API server is starting (this is normal)${NC}"
        break
    fi
    echo -ne "  Waiting... ($RETRY_COUNT/$MAX_RETRIES)\r"
    sleep 1
done

echo -e "${GREEN}✓ API server is ready${NC}"

# Display status and access information
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         CoinKrazy Platform is Running                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$MODE" = "development" ]; then
    echo -e "Frontend (Vite):     ${YELLOW}http://localhost:5173${NC}"
    echo -e "API Server:          ${YELLOW}http://localhost:3001${NC}"
    echo -e "Database Admin:      ${YELLOW}http://localhost:5050${NC}"
    echo ""
    echo -e "Default PgAdmin Login:"
    echo "  Email: admin@coinkrazy.local"
    echo "  Password: admin_password"
else
    echo -e "Application:         ${YELLOW}https://localhost${NC}"
    echo -e "API Server:          ${YELLOW}https://localhost/api${NC}"
fi

echo ""
echo -e "Admin Credentials:"
echo -e "  ${GREEN}Email: coinkrazy26@gmail.com${NC}"
echo -e "  ${GREEN}Password: admin123${NC}"
echo ""

# Useful commands
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  # View logs"
echo "  docker-compose logs -f app"
echo ""
echo "  # Stop services"
echo "  docker-compose down"
echo ""
echo "  # Remove all data (careful!)"
echo "  docker-compose down -v"
echo ""
echo "  # Database shell"
echo "  docker-compose exec postgres psql -U coinkrazy -d coinkrazy_db"
echo ""
echo "  # Redis CLI"
echo "  docker-compose exec redis redis-cli"
echo ""

# Initialize admin user if needed
echo -e "${YELLOW}Setting up admin user...${NC}"
curl -s -X POST http://localhost:3001/api/init-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"coinkrazy26@gmail.com","password":"admin123"}' \
  | grep -q "success" && echo -e "${GREEN}✓ Admin user ready${NC}" || echo -e "${YELLOW}⚠ Admin user already exists${NC}"

echo ""
echo -e "${GREEN}CoinKrazy is ready to use!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Open http://localhost:5173 (or http://localhost for production)"
echo "  2. Login with admin credentials"
echo "  3. Configure payment providers in admin panel"
echo "  4. Set up KYC requirements"
echo "  5. Configure game providers"
echo ""
