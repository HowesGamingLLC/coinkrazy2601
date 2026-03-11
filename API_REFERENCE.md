# CoinKrazy Platform - API Reference Guide

## Overview

Complete API documentation for the CoinKrazy social casino platform with payment processing and redemption capabilities.

## Base URLs

- **Development:** `http://localhost:3001/api`
- **Production:** `https://api.coinkrazy.com/api`

## Authentication

All authenticated endpoints require:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

## Authentication Endpoints

### Register User
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "password",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1995-01-15"
}

Response:
{
  "success": true,
  "message": "Registration successful",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "username",
    "role": "user"
  }
}
```

### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}

Response:
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "username",
    "kyc_status": "pending",
    "role": "user"
  }
}
```

## Redemption Endpoints

### Get Redemption Requirements

```
GET /api/redemptions/requirements
Authorization: Bearer <TOKEN>

Response:
{
  "success": true,
  "requirements": {
    "minimumBalance": 100,
    "currentBalance": 250,
    "kycRequired": true,
    "kycStatus": "verified",
    "isEligible": true,
    "eligibilityChecks": {
      "balanceCheck": true,
      "kycCheck": true
    }
  }
}
```

### Request Redemption

```
POST /api/redemptions/request
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "amount": 150,
  "method": "bank",  // or "cashapp"
  "bankAccountId": 1,  // Required for bank method
  "cashappHandle": "$username"  // Required for cashapp method
}

Response:
{
  "success": true,
  "message": "Redemption request submitted successfully",
  "redemption": {
    "id": 1,
    "transactionId": "redemption_1234_1",
    "amount": 150,
    "fee": 0,
    "netAmount": 150,
    "method": "bank",
    "status": "pending_approval",
    "createdAt": "2024-03-11T23:45:00Z"
  }
}
```

### Get Redemption History

```
GET /api/redemptions/history?limit=50&offset=0
Authorization: Bearer <TOKEN>

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "amount": 150,
      "currency": "USD",
      "method": "bank",
      "status": "completed",
      "fee": 0,
      "netAmount": 150,
      "createdAt": "2024-03-11T23:45:00Z",
      "completedAt": "2024-03-13T10:30:00Z",
      "amlStatus": "approved"
    }
  ],
  "count": 1
}
```

### Get Pending Redemptions (Admin)

```
GET /api/redemptions/pending
Authorization: Bearer <ADMIN_TOKEN>

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 5,
      "email": "user@example.com",
      "username": "username",
      "first_name": "John",
      "last_name": "Doe",
      "amount": 150,
      "currency": "USD",
      "method": "bank",
      "status": "pending",
      "fee": 0,
      "netAmount": 150,
      "destination_details": {
        "accountNumber": "****1234",
        "routingNumber": "****5678"
      },
      "createdAt": "2024-03-11T23:45:00Z",
      "kyc_status": "verified",
      "balance": 250
    }
  ],
  "count": 1
}
```

### Approve Redemption (Admin)

```
POST /api/redemptions/approve/:requestId
Authorization: Bearer <ADMIN_TOKEN>

Response:
{
  "success": true,
  "message": "Redemption request approved",
  "data": {
    "requestId": 1,
    "status": "approved",
    "userId": 5,
    "userEmail": "user@example.com",
    "amount": 150,
    "approvedAt": "2024-03-12T10:30:00Z"
  }
}
```

### Reject Redemption (Admin)

```
POST /api/redemptions/reject/:requestId
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "reason": "Insufficient KYC verification"
}

Response:
{
  "success": true,
  "message": "Redemption request rejected and balance refunded",
  "data": {
    "requestId": 1,
    "status": "rejected",
    "refundedAmount": 150
  }
}
```

### Complete Redemption (Admin)

```
POST /api/redemptions/complete/:requestId
Authorization: Bearer <ADMIN_TOKEN>

Response:
{
  "success": true,
  "message": "Redemption request marked as completed",
  "data": {
    "requestId": 1,
    "status": "completed",
    "completedAt": "2024-03-13T10:30:00Z"
  }
}
```

## Payment Endpoints

### Create Stripe Checkout Session

```
POST /api/payments/stripe/create-checkout-session
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "packageId": 1,
  "userId": 5
}

Response:
{
  "success": true,
  "session": {
    "id": "cs_test_...",
    "url": "https://checkout.stripe.com/pay/..."
  }
}
```

### Verify Stripe Session

```
POST /api/payments/stripe/verify-session/:sessionId
Authorization: Bearer <TOKEN>

Response:
{
  "success": true,
  "payment_status": "complete",
  "customer_email": "user@example.com"
}
```

### Create PayPal Order

```
POST /api/payments/paypal/create-order
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "packageId": 1,
  "userId": 5
}

Response:
{
  "success": true,
  "order": {
    "id": "7GH43940MR404715T",
    "status": "CREATED",
    "links": [
      {
        "rel": "approve",
        "href": "https://www.paypal.com/checkoutnow?token=..."
      }
    ]
  }
}
```

### Capture PayPal Order

```
POST /api/payments/paypal/capture-order
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "orderId": "7GH43940MR404715T",
  "userId": 5
}

Response:
{
  "success": true,
  "message": "Payment captured and processed",
  "transaction": {
    "id": "...",
    "status": "completed",
    "amount": 9.99,
    "currency": "USD"
  }
}
```

## Wallet & Balance Endpoints

### Get User Balance

```
GET /api/balances/:userId
Authorization: Bearer <TOKEN>

Response:
{
  "success": true,
  "balances": {
    "GC": {
      "balance": 500,
      "locked": 0,
      "total_deposited": 1000,
      "total_won": 200
    },
    "SC": {
      "balance": 250,
      "locked": 0,
      "total_won": 150
    }
  }
}
```

### Update Balance

```
POST /api/balances/:userId/update
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "currency": "GC",
  "amount": 100,
  "transactionType": "bonus",
  "description": "Daily bonus reward"
}

Response:
{
  "success": true,
  "balance": 600,
  "transaction": {
    "id": 1,
    "amount": 100,
    "type": "bonus",
    "timestamp": "2024-03-11T23:45:00Z"
  }
}
```

## KYC Endpoints

### Submit KYC Information

```
POST /api/kyc/submit
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1995-01-15",
  "country": "US",
  "state": "CA",
  "city": "San Francisco",
  "zipCode": "94102",
  "address": "123 Main St"
}

Response:
{
  "success": true,
  "message": "KYC information submitted for verification",
  "kyc_status": "pending"
}
```

### Get KYC Status

```
GET /api/kyc/status
Authorization: Bearer <TOKEN>

Response:
{
  "success": true,
  "kyc_status": "pending",
  "submitted_at": "2024-03-11T23:45:00Z",
  "verified_at": null
}
```

### Get Pending KYC (Admin)

```
GET /api/kyc/pending
Authorization: Bearer <ADMIN_TOKEN>

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 5,
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "submitted_at": "2024-03-11T23:45:00Z",
      "status": "pending"
    }
  ],
  "count": 1
}
```

### Approve KYC (Admin)

```
PATCH /api/kyc/:userId/approve
Authorization: Bearer <ADMIN_TOKEN>

Response:
{
  "success": true,
  "message": "KYC approved",
  "kyc_status": "verified"
}
```

### Reject KYC (Admin)

```
PATCH /api/kyc/:userId/reject
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "reason": "Document unclear"
}

Response:
{
  "success": true,
  "message": "KYC rejected",
  "kyc_status": "rejected"
}
```

## Games Endpoints

### Get Active Games

```
GET /api/games/active
Authorization: Bearer <TOKEN>

Response:
{
  "success": true,
  "games": [
    {
      "id": "slots_1",
      "name": "Coins Slots",
      "type": "slots",
      "provider": "internal",
      "minBet": 1,
      "maxBet": 100,
      "rtp": 96.5,
      "active": true
    }
  ],
  "count": 5
}
```

### Start Game Session

```
POST /api/games/:gameId/start
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "currency": "SC",
  "startBalance": 100
}

Response:
{
  "success": true,
  "session": {
    "session_id": "session_123",
    "game_id": "slots_1",
    "currency": "SC",
    "start_balance": 100,
    "current_balance": 100
  }
}
```

## Health Check

### API Ping

```
GET /api/ping

Response:
{
  "success": true,
  "message": "API is running"
}
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional details if available"
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Minimum balance of 100 SC required" | Insufficient SC balance | Deposit more SC or complete games |
| "KYC verification required" | User not KYC verified | Submit and get KYC approved |
| "Invalid payment method" | Unsupported method | Use bank or cashapp |
| "Insufficient balance" | Not enough currency | Deposit or earn more balance |
| "Account suspended" | Account banned | Contact support |

## Rate Limiting

Endpoints are rate-limited:
- **General API:** 10 requests/second per IP
- **Auth endpoints:** 5 requests/second per IP
- **Admin endpoints:** 20 requests/second per admin user

Rate limit headers:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1615426800
```

## Pagination

List endpoints support pagination:
```
GET /api/endpoint?limit=50&offset=0
```

Parameters:
- `limit`: Number of results (default: 50, max: 100)
- `offset`: Number of results to skip (default: 0)

Response includes:
```json
{
  "success": true,
  "data": [...],
  "count": 50,
  "total": 1000,
  "limit": 50,
  "offset": 0
}
```

## Webhooks

### Stripe Webhook

```
POST /api/payments/stripe/webhook

Headers:
stripe-signature: t=...,v1=...
```

Events:
- `checkout.session.completed` - Payment successful
- `charge.refunded` - Refund processed

### PayPal Webhook

```
POST /api/payments/paypal/webhook

Headers:
PAYPAL-TRANSMISSION-ID: ...
PAYPAL-TRANSMISSION-TIME: ...
PAYPAL-CERT-URL: ...
PAYPAL-AUTH-ALGO: ...
PAYPAL-TRANSMISSION-SIG: ...
```

Events:
- `CHECKOUT.ORDER.COMPLETED` - Order completed
- `CHECKOUT.ORDER.APPROVED` - Order approved

## SDKs & Libraries

### JavaScript/TypeScript

```typescript
import fetch from 'node-fetch';

const token = 'your_jwt_token';
const baseURL = 'http://localhost:3001/api';

// Helper function
async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${baseURL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  return response.json();
}

// Usage
const balance = await apiRequest('/balances/5');
```

### cURL

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Get balance
curl -X GET http://localhost:3001/api/balances/5 \
  -H "Authorization: Bearer your_token"

# Request redemption
curl -X POST http://localhost:3001/api/redemptions/request \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 150,
    "method": "bank",
    "bankAccountId": 1
  }'
```

## Support

For API issues:
1. Check this documentation
2. Review error message and HTTP status code
3. Check server logs: `docker-compose logs app`
4. Test with cURL first before integrating
5. Contact support with error details
