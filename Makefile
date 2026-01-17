.PHONY: up down build logs logs-core logs-worker logs-redis \
        dev dev-down restart clean ps shell-core shell-worker \
        health redis-cli

# ============================================
# Production Commands
# ============================================

up: ## Start all services
	docker compose up -d

down: ## Stop all services
	docker compose down

build: ## Build all images
	docker compose build

rebuild: ## Rebuild all images without cache
	docker compose build --no-cache

restart: ## Restart all services
	docker compose restart

# ============================================
# Development Commands
# ============================================

dev: ## Start in development mode with hot reload
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

dev-down: ## Stop development services
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

dev-build: ## Build development images
	docker compose -f docker-compose.yml -f docker-compose.dev.yml build

dev-logs: ## Follow all logs in development
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

# ============================================
# Logs
# ============================================

logs: ## Follow all logs
	docker compose logs -f

logs-core: ## Follow core service logs
	docker compose logs -f core-app

logs-worker: ## Follow worker service logs
	docker compose logs -f doc-worker

logs-redis: ## Follow redis logs
	docker compose logs -f redis

# ============================================
# Status & Health
# ============================================

ps: ## Show running containers
	docker compose ps

health: ## Check health of all services
	@echo "=== Core App ===" && \
	docker compose exec core-app wget -qO- http://localhost:3000/health 2>/dev/null || echo "unhealthy or not running"
	@echo "\n=== Doc Worker ===" && \
	docker compose exec doc-worker curl -sf http://localhost:8000/health 2>/dev/null || echo "unhealthy or not running"
	@echo "\n=== Redis ===" && \
	docker compose exec redis redis-cli ping 2>/dev/null || echo "unhealthy or not running"

# ============================================
# Shell Access
# ============================================

shell-core: ## Open shell in core container
	docker compose exec core-app sh

shell-worker: ## Open shell in worker container
	docker compose exec doc-worker bash

redis-cli: ## Open Redis CLI
	docker compose exec redis redis-cli

# ============================================
# Cleanup
# ============================================

clean: ## Stop services and remove volumes
	docker compose down -v

prune: ## Remove unused Docker resources
	docker system prune -f

# ============================================
# Help
# ============================================

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
