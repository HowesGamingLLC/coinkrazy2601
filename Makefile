.PHONY: help dev prod up down logs clean test build rebuild

# Color output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m # No Color

help:
	@echo "$(GREEN)CoinKrazy Platform - Docker Operations$(NC)"
	@echo ""
	@echo "$(YELLOW)Development:$(NC)"
	@echo "  make dev              Start development environment"
	@echo "  make dev-logs         View development logs"
	@echo ""
	@echo "$(YELLOW)Production:$(NC)"
	@echo "  make prod             Start production environment"
	@echo "  make prod-logs        View production logs"
	@echo ""
	@echo "$(YELLOW)Services:$(NC)"
	@echo "  make up               Start all services"
	@echo "  make down             Stop all services"
	@echo "  make restart          Restart all services"
	@echo "  make status           Show service status"
	@echo ""
	@echo "$(YELLOW)Database:$(NC)"
	@echo "  make db-shell         Access PostgreSQL shell"
	@echo "  make db-backup        Backup database"
	@echo "  make db-restore       Restore database (requires BACKUP_FILE)"
	@echo ""
	@echo "$(YELLOW)Maintenance:$(NC)"
	@echo "  make build            Build Docker images"
	@echo "  make rebuild          Rebuild Docker images"
	@echo "  make clean            Clean up Docker containers and volumes"
	@echo "  make test             Run tests"
	@echo "  make lint             Run linter"
	@echo ""

# Development
dev:
	@echo "$(YELLOW)Starting development environment...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Development environment started$(NC)"
	@echo "Frontend: http://localhost:5173"
	@echo "API:      http://localhost:3001"

dev-logs:
	docker-compose logs -f

# Production
prod:
	@echo "$(YELLOW)Starting production environment...$(NC)"
	docker-compose -f docker-compose.yml --profile production up -d
	@echo "$(GREEN)✓ Production environment started$(NC)"
	@echo "Application: https://localhost"

prod-logs:
	docker-compose -f docker-compose.yml --profile production logs -f

# Services
up:
	docker-compose up -d

down:
	docker-compose down

restart:
	@echo "$(YELLOW)Restarting services...$(NC)"
	docker-compose restart
	@echo "$(GREEN)✓ Services restarted$(NC)"

status:
	@echo "$(YELLOW)Service Status:$(NC)"
	docker-compose ps

# Database
db-shell:
	docker-compose exec postgres psql -U coinkrazy -d coinkrazy_db

db-backup:
	@echo "$(YELLOW)Backing up database...$(NC)"
	docker-compose exec postgres pg_dump -U coinkrazy coinkrazy_db > backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Database backed up$(NC)"

db-restore:
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo "$(RED)Error: BACKUP_FILE not specified$(NC)"; \
		echo "Usage: make db-restore BACKUP_FILE=backup.sql"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Restoring database from $(BACKUP_FILE)...$(NC)"
	cat $(BACKUP_FILE) | docker-compose exec -T postgres psql -U coinkrazy -d coinkrazy_db
	@echo "$(GREEN)✓ Database restored$(NC)"

# Building
build:
	@echo "$(YELLOW)Building Docker images...$(NC)"
	docker-compose build

rebuild:
	@echo "$(YELLOW)Rebuilding Docker images...$(NC)"
	docker-compose build --no-cache

# Maintenance
clean:
	@echo "$(RED)Warning: This will remove all containers and volumes!$(NC)"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds..."
	@sleep 5
	docker-compose down -v
	@echo "$(GREEN)✓ Cleaned up$(NC)"

test:
	@echo "$(YELLOW)Running tests...$(NC)"
	docker-compose exec app npm test

lint:
	@echo "$(YELLOW)Running linter...$(NC)"
	docker-compose exec app npm run lint

# Admin operations
init-admin:
	@echo "$(YELLOW)Initializing admin user...$(NC)"
	curl -X POST http://localhost:3001/api/init-admin \
		-H "Content-Type: application/json" \
		-d '{"email":"coinkrazy26@gmail.com","password":"admin123"}'
	@echo ""
	@echo "$(GREEN)✓ Admin user initialized$(NC)"

# Additional utilities
ps:
	docker-compose ps

logs:
	docker-compose logs -f

shell:
	docker-compose exec app /bin/sh

redis-cli:
	docker-compose exec redis redis-cli

pgadmin:
	@echo "$(GREEN)PgAdmin available at: http://localhost:5050$(NC)"
	@echo "Email: admin@coinkrazy.local"
	@echo "Password: admin_password"

# Development utilities
format:
	docker-compose exec app npm run format.fix

typecheck:
	docker-compose exec app npm run typecheck

install:
	docker-compose exec app npm install

# Health check
health:
	@echo "$(YELLOW)Checking service health...$(NC)"
	@curl -s http://localhost:3001/api/ping > /dev/null && echo "$(GREEN)✓ API$(NC)" || echo "$(RED)✗ API$(NC)"
	@docker-compose exec postgres pg_isready -U coinkrazy > /dev/null 2>&1 && echo "$(GREEN)✓ Database$(NC)" || echo "$(RED)✗ Database$(NC)"
	@docker-compose exec redis redis-cli ping > /dev/null 2>&1 && echo "$(GREEN)✓ Redis$(NC)" || echo "$(RED)✗ Redis$(NC)"
