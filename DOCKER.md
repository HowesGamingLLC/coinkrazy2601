# CoinKrazy Platform - Docker Deployment Guide

Complete guide for deploying the CoinKrazy sweepstakes social casino platform using Docker.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Services](#services)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## Prerequisites

- Docker 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- Docker Compose 2.0+ ([Install Docker Compose](https://docs.docker.com/compose/install/))
- At least 4GB of free RAM
- 10GB of available disk space

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/HowesGamingLLC/coinkrazy.git
cd coinkrazy
```

### 2. Run the startup script

```bash
chmod +x scripts/docker-start.sh
./scripts/docker-start.sh
```

The script will:
- Check Docker installation
- Create `.env` file from `.env.example`
- Build Docker images
- Start all services
- Initialize the database
- Create the admin user

### 3. Access the platform

**Development:**
- Frontend: http://localhost:5173
- API: http://localhost:3001
- Database Admin: http://localhost:5050

**Admin Credentials:**
- Email: `coinkrazy26@gmail.com`
- Password: `admin123`

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and update with your values:

```bash
cp .env.example .env
```

#### Critical Configuration

1. **Database**
   ```
   DATABASE_URL=postgresql://coinkrazy:password@postgres:5432/coinkrazy_db
   ```

2. **Authentication**
   ```
   JWT_SECRET=your_jwt_secret_here
   SESSION_SECRET=your_session_secret_here
   ```

3. **Payment Providers** (required for deposits)
   - Stripe
   - PayPal
   - Square
   - CashApp

4. **ACH Processing** (for bank transfers)
   - Dwolla or Moov.io API credentials

5. **Email Service**
   ```
   SMTP_USER=your_gmail@gmail.com
   SMTP_PASS=your_app_password
   ```

### Payment Provider Setup

#### Stripe Setup
1. Get your API keys from https://dashboard.stripe.com/
2. Set in `.env`:
   ```
   STRIPE_PUBLIC_KEY=pk_live_xxxxx
   STRIPE_SECRET_KEY=sk_live_xxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

#### PayPal Setup
1. Get credentials from https://www.paypal.com/
2. Set in `.env`:
   ```
   PAYPAL_CLIENT_ID=xxxxx
   PAYPAL_CLIENT_SECRET=xxxxx
   ```

#### Square Setup
1. Get credentials from https://squareup.com/
2. Set in `.env`:
   ```
   SQUARE_ACCESS_TOKEN=sq_live_xxxxx
   SQUARE_APPLICATION_ID=sq_app_xxxxx
   SQUARE_LOCATION_ID=xxxxx
   ```

#### CashApp Setup
1. Contact CashApp Business
2. Set in `.env`:
   ```
   CASHAPP_API_KEY=ca_api_xxxxx
   CASHAPP_CLIENT_ID=ca_client_xxxxx
   ```

#### ACH/Bank Transfer Setup

Use Dwolla (recommended):
1. Get API token from https://www.dwolla.com/
2. Set in `.env`:
   ```
   DWOLLA_TOKEN=prod_xxxxx
   DWOLLA_FUNDING_SOURCE=xxxxx
   ```

## Services

### Docker Compose Services

```
coinkrazy-postgres    - PostgreSQL database
coinkrazy-redis       - Redis cache
coinkrazy-app         - Node.js application
coinkrazy-nginx       - Nginx reverse proxy (production)
coinkrazy-pgadmin     - Database management UI (dev only)
```

### Port Mapping

| Service | Port | Purpose |
|---------|------|---------|
| Vite Dev | 5173 | Frontend development |
| Express | 3001 | Backend API |
| Nginx | 80, 443 | Reverse proxy |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache |
| PgAdmin | 5050 | Database UI (dev) |

## Development

### Start Development Environment

```bash
./scripts/docker-start.sh
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f postgres
```

### Database Access

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U coinkrazy -d coinkrazy_db

# Connect to Redis
docker-compose exec redis redis-cli
```

### Code Changes

Hot-reload is enabled in development. Changes to:
- Frontend files trigger Vite rebuild
- Backend files trigger app restart

### Running Tests

```bash
docker-compose exec app npm test
```

### Building Only

```bash
docker-compose build
```

## Production Deployment

### Production Checklist

- [ ] Update all `.env` variables with production values
- [ ] Generate strong JWT and SESSION secrets
- [ ] Configure valid SSL certificates
- [ ] Set up database backups
- [ ] Configure email for production
- [ ] Set up all payment provider accounts
- [ ] Configure ACH processor
- [ ] Enable HTTPS
- [ ] Set up monitoring and alerts
- [ ] Configure log aggregation

### Start Production Environment

```bash
# Use production compose file with nginx
docker-compose -f docker-compose.yml --profile production up -d

# Or use the startup script
./scripts/docker-start.sh prod
```

### SSL Certificates

Place SSL certificates in `ssl/` directory:
- `ssl/cert.pem` - Certificate file
- `ssl/key.pem` - Private key file

Generate self-signed (development):
```bash
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem \
  -subj "/CN=yourdomain.com"
```

### Database Backups

Automated daily backups:
```bash
# Manual backup
docker-compose exec postgres pg_dump -U coinkrazy coinkrazy_db > backup.sql

# Restore from backup
cat backup.sql | docker-compose exec -T postgres psql -U coinkrazy -d coinkrazy_db
```

### Scaling

For production, consider:
- Database replicas
- Redis cluster
- Multiple application instances
- Load balancer (Nginx or cloud provider)
- CDN for static assets

## Common Tasks

### Stop All Services

```bash
docker-compose down
```

### Stop and Remove Data

```bash
docker-compose down -v
```

### Restart Services

```bash
docker-compose restart

# Restart specific service
docker-compose restart app
```

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose up -d --build
```

### Database Migrations

```bash
# Apply schema
docker-compose exec app npm run db:migrate

# Seed database
docker-compose exec app npm run db:seed
```

### Add New Admin User

```bash
curl -X POST http://localhost:3001/api/add-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newadmin@example.com",
    "password": "secure_password"
  }'
```

## Troubleshooting

### Services Won't Start

```bash
# Check Docker daemon
docker ps

# Check logs
docker-compose logs

# Clean up and restart
docker-compose down -v
docker-compose up -d
```

### Database Connection Failed

```bash
# Check database logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U coinkrazy -d coinkrazy_db -c "SELECT 1;"
```

### Payment Provider Issues

1. Verify credentials in `.env`
2. Check API keys are valid
3. Verify webhook URLs are accessible
4. Check firewall rules

### Out of Disk Space

```bash
# Clean up Docker
docker system prune -a

# Remove unused volumes
docker volume prune
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3001

# Change port in docker-compose.override.yml
```

## Monitoring

### Health Checks

```bash
# Check all services
docker-compose ps

# Test API
curl http://localhost:3001/api/ping
```

### Performance Monitoring

```bash
# Docker stats
docker stats

# Database connections
docker-compose exec postgres psql -U coinkrazy -d coinkrazy_db \
  -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"
```

## Maintenance

### Regular Tasks

- **Weekly**: Check logs for errors
- **Monthly**: Review database size and optimize
- **Quarterly**: Security updates and patches
- **Yearly**: Full system review and testing

### Database Optimization

```bash
# Vacuum database
docker-compose exec postgres psql -U coinkrazy -d coinkrazy_db -c "VACUUM ANALYZE;"

# Reindex
docker-compose exec postgres psql -U coinkrazy -d coinkrazy_db -c "REINDEX DATABASE coinkrazy_db;"
```

### Log Rotation

Configure log rotation for production logs:

```bash
# In /etc/logrotate.d/coinkrazy
/var/lib/docker/containers/*/*.log {
  daily
  rotate 7
  compress
  delaycompress
  missingok
}
```

## Support

For issues or questions:

1. Check logs: `docker-compose logs -f`
2. Verify configuration: Check `.env` file
3. Test connectivity: `curl http://localhost:3001/api/ping`
4. Review documentation: See README.md

## License

CoinKrazy Platform - All rights reserved
