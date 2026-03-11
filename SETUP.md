# CoinKrazy Platform - Complete Setup and Testing Guide

## Quick Start (5 minutes)

### Option 1: Automated Setup (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/HowesGamingLLC/coinkrazy.git
cd coinkrazy

# 2. Run automated setup
chmod +x scripts/docker-start.sh
./scripts/docker-start.sh

# 3. Open browser
# Frontend: http://localhost:5173
# API: http://localhost:3001
```

### Option 2: Manual Docker Setup

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Update payment provider credentials in .env
# (See Configuration section below)

# 3. Start services
docker-compose up -d

# 4. Wait for services to start (30-60 seconds)

# 5. Initialize database
docker-compose exec app npm run db:init

# 6. Create admin user
curl -X POST http://localhost:3001/api/init-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"coinkrazy26@gmail.com","password":"admin123"}'
```

## Configuration

### Payment Provider Setup

Update `.env` with your payment provider credentials:

#### Stripe (Credit Card Deposits)
```bash
STRIPE_PUBLIC_KEY=pk_live_xxxxx
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```
Get credentials: https://dashboard.stripe.com/

#### PayPal (PayPal Wallet Deposits)
```bash
PAYPAL_CLIENT_ID=xxxxx
PAYPAL_CLIENT_SECRET=xxxxx
```
Get credentials: https://developer.paypal.com/

#### Square (Square Cash Deposits)
```bash
SQUARE_ACCESS_TOKEN=sq_live_xxxxx
SQUARE_APPLICATION_ID=sq_app_xxxxx
SQUARE_LOCATION_ID=xxxxx
```
Get credentials: https://squareup.com/

#### CashApp (CashApp Redemptions)
```bash
CASHAPP_API_KEY=ca_api_xxxxx
CASHAPP_CLIENT_ID=ca_client_xxxxx
```
Contact CashApp Business support

#### Bank Transfer/ACH (Redemptions)
```bash
# Using Dwolla
DWOLLA_TOKEN=prod_xxxxx
DWOLLA_FUNDING_SOURCE=xxxxx

# OR using Moov.io
MOOV_ACCESS_TOKEN=xxxxx
MOOV_ACCOUNT_ID=xxxxx
```

### Email Service Setup

```bash
# Gmail SMTP for notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password  # Generate at: myaccount.google.com/apppasswords
FROM_EMAIL=noreply@coinkrazy.com
```

## Testing the Platform

### 1. Access the Platform

**Development:**
- Frontend: http://localhost:5173
- API: http://localhost:3001
- Database Admin (PgAdmin): http://localhost:5050

**Admin Credentials:**
- Email: `coinkrazy26@gmail.com`
- Password: `admin123`

### 2. User Registration Flow

1. Navigate to registration page
2. Create test user account with:
   - Email
   - Username
   - Password
   - First/Last name
   - Date of birth (18+)
3. Verify email (check inbox or use test email)
4. User receives welcome bonus (10 GC + 10 SC)

### 3. KYC Verification

KYC must be verified before redemption:

1. Navigate to Settings > KYC
2. Submit verification information:
   - Legal name
   - Address
   - Document (ID, Passport, Driver's License)
3. As admin, approve KYC:
   ```bash
   # Admin panel > KYC Management > Approve
   ```

### 4. Deposit/Payment Flow

#### Test Stripe Payment:
1. Go to Store > Gold Coins
2. Select package (e.g., $10 package)
3. Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/25)
   - CVC: Any 3 digits (e.g., 123)
4. Payment processed
5. GC balance updated

#### Test PayPal Payment:
1. Go to Store > Gold Coins
2. Select PayPal payment method
3. Use PayPal sandbox account
4. Complete payment
5. Webhook processes payment automatically

### 5. Redemption/Cashout Flow

#### Requirements:
- Minimum 100 SC balance
- KYC must be verified
- Account in good standing

#### Test Bank Transfer Redemption:
1. Go to Wallet > Redeem
2. Select "Bank Transfer (Free)"
3. Enter:
   - Amount (100-5000 SC)
   - Bank account details
4. Submit request
5. Admin review pending redemptions:
   - Admin panel > Redemptions > Pending
   - Verify KYC status
   - Verify balance
   - Click "Approve"
6. Redemption marked as processing
7. Complete ACH transfer (1-3 business days)

#### Test CashApp Redemption:
1. Go to Wallet > Redeem
2. Select "CashApp ($5 fee)"
3. Enter:
   - Amount (100-5000 SC)
   - CashApp handle/tag
4. Submit request
5. $5 fee deducted
6. Admin approval required
7. Funds transferred via CashApp API

### 6. Admin Panel Testing

#### User Management:
```
Admin Panel > Users
- Search/filter users
- View user details
- Update user role
- Suspend/ban accounts
- View transaction history
```

#### KYC Management:
```
Admin Panel > KYC
- View pending verifications
- Review submitted documents
- Approve/Reject KYC
- Update KYC status
```

#### Redemption Management:
```
Admin Panel > Redemptions
- View all redemption requests
- Filter by status (pending, approved, processing, completed)
- Approve/reject requests
- Complete redemptions
- View transaction details
```

#### Payment Methods:
```
Admin Panel > Payment Settings
- Configure payment providers
- Set fees and limits
- Enable/disable methods
- View transaction history
```

#### Game Management:
```
Admin Panel > Games
- Enable/disable games
- Configure game settings
- View game statistics
- Update game metadata
```

## Feature Checklist

### Authentication & User Management
- [x] User registration
- [x] Email verification
- [x] Login/logout
- [x] Password reset
- [x] JWT token authentication
- [x] Admin role management

### KYC & Compliance
- [x] KYC form submission
- [x] Document upload
- [x] Admin KYC verification
- [x] KYC enforcement for redemptions
- [x] Status tracking

### Wallet & Balances
- [x] Dual currency (GC/SC)
- [x] Real-time balance updates
- [x] Transaction history
- [x] Balance locks for pending transactions
- [x] Daily bonus rewards

### Deposits
- [x] Stripe integration
- [x] PayPal integration
- [x] Square integration
- [x] Payment method selection
- [x] Transaction receipt
- [x] Automatic balance update
- [x] Fee calculations

### Redemptions
- [x] Minimum 100 SC requirement
- [x] KYC verification requirement
- [x] Bank transfer (free)
- [x] CashApp ($5 fee)
- [x] Admin approval workflow
- [x] ACH/Bank processing
- [x] Fee deductions
- [x] Transaction tracking
- [x] Redemption history

### Games
- [x] Slots game
- [x] Bingo game
- [x] Poker game
- [x] Scratch cards
- [x] Game statistics
- [x] Leaderboards
- [x] Win/loss tracking
- [x] Currency selection (GC/SC)

### Admin Features
- [x] User management
- [x] KYC management
- [x] Redemption approval
- [x] Payment provider setup
- [x] Game management
- [x] Analytics dashboard
- [x] Transaction reports
- [x] System settings

### Security
- [x] Password hashing (bcrypt)
- [x] JWT token validation
- [x] HTTPS/SSL support
- [x] SQL injection prevention
- [x] XSS protection
- [x] CSRF protection
- [x] Rate limiting
- [x] DDoS protection (Nginx)

## Testing Scenarios

### Scenario 1: Complete User Lifecycle

1. Register new user
2. Verify email
3. Complete KYC
4. Deposit $10 via Stripe
5. Play games (bet/win)
6. Redeem 100 SC via bank transfer
7. Admin approval
8. Verify funds transferred

### Scenario 2: CashApp Redemption

1. Register user
2. Verify KYC
3. Deposit via PayPal
4. Win games to accumulate SC
5. Redeem via CashApp
6. Verify $5 fee deducted
7. Admin approval
8. Verify CashApp transfer

### Scenario 3: Payment Failure Handling

1. Attempt deposit with invalid card
2. Verify error message
3. Verify balance unchanged
4. Retry with valid card
5. Verify successful transaction

### Scenario 4: Admin Operations

1. Create admin user
2. Review pending redemptions
3. Approve/reject redemptions
4. Update payment settings
5. Manage users
6. View analytics

## Troubleshooting

### Services Won't Start
```bash
# Check Docker
docker ps

# View logs
docker-compose logs

# Restart
docker-compose restart
```

### Database Issues
```bash
# Connect to database
docker-compose exec postgres psql -U coinkrazy -d coinkrazy_db

# Check tables
\dt

# View specific table
SELECT * FROM users LIMIT 1;
```

### Payment Issues

1. **Stripe test mode:**
   - Use test API keys from dashboard
   - Use test card: 4242 4242 4242 4242
   - Use any future expiry and any CVC

2. **PayPal sandbox:**
   - Create sandbox account
   - Use sandbox API credentials
   - Use test accounts

3. **Square test:**
   - Enable test mode
   - Use test API credentials
   - Use test card from documentation

### Common Errors

| Error | Solution |
|-------|----------|
| "Port already in use" | Stop other services on that port or change port in `.env` |
| "Database connection failed" | Wait for postgres to start, check `docker-compose logs postgres` |
| "Payment declined" | Verify payment credentials in `.env` |
| "KYC required" | Submit and approve KYC before redemption |
| "Insufficient balance" | Ensure user has 100+ SC |

## Performance Testing

### Load Testing
```bash
# Using Apache Bench
ab -n 1000 -c 10 http://localhost:3001/api/ping

# Using wrk
wrk -t4 -c100 -d30s http://localhost:3001/api/ping
```

### Database Performance
```bash
# Check slow queries
docker-compose exec postgres psql -U coinkrazy -d coinkrazy_db -c "\dt"

# Check index usage
docker-compose exec postgres psql -U coinkrazy -d coinkrazy_db -c "SELECT * FROM pg_stat_user_indexes;"
```

## Production Deployment

1. Update `.env` with production values
2. Generate SSL certificates
3. Configure domain/DNS
4. Deploy to production environment
5. Run database migrations
6. Configure monitoring/alerts
7. Set up backup procedures
8. Enable logging and analytics

See `DOCKER.md` for detailed production deployment guide.

## Support & Documentation

- **Docker Guide:** See `DOCKER.md`
- **API Documentation:** See `server/README.md`
- **Frontend Guide:** See `client/README.md`
- **Database Schema:** See `server/database/banking-schema.sql`

## Quick Commands

```bash
# Start development
make dev

# View logs
make logs

# Run tests
make test

# Database shell
make db-shell

# Restart services
make restart

# Clean up
make clean
```

See `Makefile` for all available commands.
