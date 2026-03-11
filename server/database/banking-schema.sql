-- ============================================================================
-- COINKRAZY BANKING & PAYMENTS DATABASE SCHEMA
-- Production-ready banking and payment processing system
-- ============================================================================

-- Payment providers table
CREATE TABLE IF NOT EXISTS payment_providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL, -- stripe, paypal, crypto, bank_wire, etc
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'maintenance')),
    api_endpoint VARCHAR(255),
    api_key_encrypted TEXT,
    api_secret_encrypted TEXT,
    webhook_url VARCHAR(255),
    supported_currencies TEXT[] DEFAULT '{}',
    supported_countries TEXT[] DEFAULT '{}',
    configuration JSONB DEFAULT '{}',
    fees JSONB DEFAULT '{}', -- {deposit: 2.9, withdrawal: 3.5, processing: 0.3}
    limits JSONB DEFAULT '{}', -- {min_deposit: 10, max_deposit: 5000, daily_limit: 10000}
    processing_times JSONB DEFAULT '{}', -- {deposit: "instant", withdrawal: "1-3 days"}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES payment_providers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- credit_card, crypto, e_wallet, bank_transfer
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'maintenance')),
    icon_url VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    min_deposit DECIMAL(15,2) DEFAULT 0,
    max_deposit DECIMAL(15,2) DEFAULT 999999,
    min_withdrawal DECIMAL(15,2) DEFAULT 0,
    max_withdrawal DECIMAL(15,2) DEFAULT 999999,
    daily_limit DECIMAL(15,2) DEFAULT 999999,
    deposit_fee_percent DECIMAL(5,2) DEFAULT 0,
    deposit_fee_fixed DECIMAL(15,2) DEFAULT 0,
    withdrawal_fee_percent DECIMAL(5,2) DEFAULT 0,
    withdrawal_fee_fixed DECIMAL(15,2) DEFAULT 0,
    requires_kyc BOOLEAN DEFAULT true,
    requires_documents BOOLEAN DEFAULT false,
    auto_approve_deposits BOOLEAN DEFAULT false,
    auto_approve_withdrawals BOOLEAN DEFAULT false,
    auto_approve_deposit_limit DECIMAL(15,2) DEFAULT 0,
    auto_approve_withdrawal_limit DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced transactions table for banking
CREATE TABLE IF NOT EXISTS banking_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    payment_method_id INTEGER REFERENCES payment_methods(id),
    provider_id INTEGER REFERENCES payment_providers(id),
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'refund', 'chargeback', 'fee')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'disputed', 'reversed')),
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    fee_amount DECIMAL(15,2) DEFAULT 0,
    net_amount DECIMAL(15,2) NOT NULL, -- amount - fees
    
    -- Payment provider details
    provider_transaction_id VARCHAR(255),
    provider_reference VARCHAR(255),
    provider_status VARCHAR(50),
    provider_response JSONB,
    
    -- User payment details
    payment_details JSONB, -- encrypted card details, crypto addresses, etc
    billing_address JSONB,
    
    -- Risk and compliance
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    fraud_flags TEXT[],
    compliance_checks JSONB,
    aml_status VARCHAR(20) DEFAULT 'pending' CHECK (aml_status IN ('pending', 'approved', 'flagged', 'rejected')),
    sanctions_checked BOOLEAN DEFAULT false,
    
    -- Processing details
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Approval workflow
    requires_manual_approval BOOLEAN DEFAULT false,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- Additional metadata
    user_ip INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bank accounts for withdrawals
CREATE TABLE IF NOT EXISTS user_bank_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('checking', 'savings', 'business')),
    bank_name VARCHAR(100) NOT NULL,
    account_holder_name VARCHAR(255) NOT NULL,
    account_number_encrypted TEXT NOT NULL,
    routing_number_encrypted TEXT NOT NULL,
    swift_code VARCHAR(20),
    iban VARCHAR(50),
    currency VARCHAR(10) DEFAULT 'USD',
    country VARCHAR(2) NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    is_primary BOOLEAN DEFAULT false,
    verification_deposits JSONB, -- micro-deposits for verification
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed')),
    verification_date TIMESTAMP,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crypto wallets for deposits/withdrawals
CREATE TABLE IF NOT EXISTS user_crypto_wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL, -- BTC, ETH, LTC, etc
    address VARCHAR(255) NOT NULL,
    label VARCHAR(100),
    is_verified BOOLEAN DEFAULT false,
    verification_transaction VARCHAR(255),
    is_primary BOOLEAN DEFAULT false,
    balance DECIMAL(18,8) DEFAULT 0,
    last_balance_check TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, currency, address)
);

-- Payment cards for users
CREATE TABLE IF NOT EXISTS user_payment_cards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    card_type VARCHAR(20) NOT NULL, -- visa, mastercard, amex, discover
    last_four VARCHAR(4) NOT NULL,
    brand VARCHAR(20) NOT NULL,
    exp_month INTEGER NOT NULL CHECK (exp_month >= 1 AND exp_month <= 12),
    exp_year INTEGER NOT NULL,
    card_holder_name VARCHAR(255) NOT NULL,
    billing_address JSONB,
    is_verified BOOLEAN DEFAULT false,
    is_primary BOOLEAN DEFAULT false,
    provider_token TEXT, -- tokenized card from payment processor
    fingerprint VARCHAR(255), -- unique card fingerprint
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Withdrawal requests
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    transaction_id INTEGER REFERENCES banking_transactions(id),
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    method VARCHAR(50) NOT NULL, -- bank_transfer, crypto, check, etc
    destination_details JSONB NOT NULL, -- bank account, crypto address, etc
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected', 'cancelled')),
    
    -- Approval workflow
    requires_approval BOOLEAN DEFAULT true,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- Processing details
    processing_fee DECIMAL(15,2) DEFAULT 0,
    net_amount DECIMAL(15,2) NOT NULL,
    expected_completion DATE,
    completed_at TIMESTAMP,
    
    -- Compliance and verification
    kyc_required BOOLEAN DEFAULT true,
    documents_required BOOLEAN DEFAULT false,
    compliance_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chargebacks and disputes
CREATE TABLE IF NOT EXISTS chargebacks (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES banking_transactions(id),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    provider_case_id VARCHAR(255),
    reason_code VARCHAR(50),
    reason_description TEXT,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'under_review', 'accepted', 'disputed', 'won', 'lost')),
    
    -- Important dates
    transaction_date TIMESTAMP,
    chargeback_date TIMESTAMP,
    response_due_date TIMESTAMP,
    resolution_date TIMESTAMP,
    
    -- Evidence and documentation
    evidence JSONB,
    merchant_response TEXT,
    final_outcome VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fraud detection and risk management
CREATE TABLE IF NOT EXISTS fraud_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL, -- velocity, amount, location, device, etc
    conditions JSONB NOT NULL, -- rule conditions in JSON format
    action VARCHAR(50) NOT NULL, -- block, flag, require_approval, etc
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk assessments for transactions
CREATE TABLE IF NOT EXISTS risk_assessments (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES banking_transactions(id),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    overall_risk_score INTEGER NOT NULL CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),
    risk_factors JSONB, -- detailed risk analysis
    triggered_rules TEXT[], -- array of triggered fraud rule IDs
    recommendations TEXT[],
    assessor VARCHAR(50) DEFAULT 'system', -- system, manual, ai
    assessed_by INTEGER REFERENCES users(id),
    assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Banking settings and configuration
CREATE TABLE IF NOT EXISTS banking_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Financial reconciliation
CREATE TABLE IF NOT EXISTS financial_reconciliation (
    id SERIAL PRIMARY KEY,
    reconciliation_date DATE NOT NULL,
    provider_id INTEGER REFERENCES payment_providers(id),
    total_deposits DECIMAL(15,2) DEFAULT 0,
    total_withdrawals DECIMAL(15,2) DEFAULT 0,
    total_fees DECIMAL(15,2) DEFAULT 0,
    total_chargebacks DECIMAL(15,2) DEFAULT 0,
    net_settlement DECIMAL(15,2) DEFAULT 0,
    provider_settlement DECIMAL(15,2),
    variance DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'discrepancy', 'resolved')),
    reconciled_by INTEGER REFERENCES users(id),
    reconciled_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_banking_transactions_user_id ON banking_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_banking_transactions_status ON banking_transactions(status);
CREATE INDEX IF NOT EXISTS idx_banking_transactions_type ON banking_transactions(type);
CREATE INDEX IF NOT EXISTS idx_banking_transactions_created_at ON banking_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_banking_transactions_provider_id ON banking_transactions(provider_id);
CREATE INDEX IF NOT EXISTS idx_banking_transactions_provider_transaction_id ON banking_transactions(provider_transaction_id);

CREATE INDEX IF NOT EXISTS idx_user_bank_accounts_user_id ON user_bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_crypto_wallets_user_id ON user_crypto_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_payment_cards_user_id ON user_payment_cards(user_id);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON withdrawal_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_chargebacks_transaction_id ON chargebacks(transaction_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_status ON chargebacks(status);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_transaction_id ON risk_assessments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_user_id ON risk_assessments(user_id);

-- Insert default payment providers
INSERT INTO payment_providers (name, type, status, supported_currencies, supported_countries, configuration, fees, limits, processing_times) VALUES
('Stripe', 'stripe', 'active', '{"USD","EUR","GBP","CAD"}', '{"US","CA","UK","EU"}',
 '{"publishable_key":"pk_live_...", "webhook_secret":"whsec_..."}',
 '{"deposit_percent":2.9, "deposit_fixed":0.30, "withdrawal_percent":3.5, "withdrawal_fixed":0.50}',
 '{"min_deposit":5, "max_deposit":5000, "min_withdrawal":10, "max_withdrawal":2000, "daily_limit":10000}',
 '{"deposit":"instant", "withdrawal":"1-3 business days"}'
),
('PayPal', 'paypal', 'active', '{"USD","EUR","GBP"}', '{"US","CA","UK","EU"}',
 '{"client_id":"AXWtj2iF8H4a4bdDE0", "environment":"live"}',
 '{"deposit_percent":3.5, "deposit_fixed":0.49, "withdrawal_percent":2.9, "withdrawal_fixed":0.30}',
 '{"min_deposit":10, "max_deposit":3000, "min_withdrawal":25, "max_withdrawal":1500, "daily_limit":5000}',
 '{"deposit":"instant", "withdrawal":"24-48 hours"}'
),
('BitPay', 'crypto', 'active', '{"BTC","ETH","LTC","BCH"}', '{"GLOBAL"}',
 '{"api_token":"abc123def456", "network":"mainnet"}',
 '{"deposit_percent":1.0, "deposit_fixed":0, "withdrawal_percent":0.5, "withdrawal_fixed":0}',
 '{"min_deposit":25, "max_deposit":10000, "min_withdrawal":50, "max_withdrawal":5000, "daily_limit":25000}',
 '{"deposit":"1-6 confirmations", "withdrawal":"1-2 hours"}'
),
('Square', 'square', 'active', '{"USD"}', '{"US"}',
 '{"application_id":"sq_app_...", "access_token":"sq_token_..."}',
 '{"deposit_percent":2.5, "deposit_fixed":0.30, "withdrawal_percent":0, "withdrawal_fixed":0}',
 '{"min_deposit":1, "max_deposit":2500, "min_withdrawal":50, "max_withdrawal":5000, "daily_limit":10000}',
 '{"deposit":"instant", "withdrawal":"1-3 business days"}'
),
('CashApp', 'cashapp', 'active', '{"USD"}', '{"US"}',
 '{"api_key":"ca_api_...", "client_id":"ca_client_..."}',
 '{"deposit_percent":0, "deposit_fixed":0, "withdrawal_percent":2.1, "withdrawal_fixed":5.00}',
 '{"min_deposit":1, "max_deposit":10000, "min_withdrawal":100, "max_withdrawal":5000, "daily_limit":20000}',
 '{"deposit":"instant", "withdrawal":"1-2 business days"}'
),
('ACH Bank Transfer', 'ach', 'active', '{"USD"}', '{"US"}',
 '{"processor":"ach_processor", "routing_required":true}',
 '{"deposit_percent":0, "deposit_fixed":0, "withdrawal_percent":0, "withdrawal_fixed":0}',
 '{"min_deposit":25, "max_deposit":50000, "min_withdrawal":100, "max_withdrawal":25000, "daily_limit":50000}',
 '{"deposit":"1-3 business days", "withdrawal":"1-3 business days"}'
) ON CONFLICT (name) DO NOTHING;

-- Insert default payment methods
INSERT INTO payment_methods (provider_id, name, type, status, min_deposit, max_deposit, min_withdrawal, max_withdrawal, daily_limit, deposit_fee_percent, deposit_fee_fixed, withdrawal_fee_percent, withdrawal_fee_fixed, requires_kyc, auto_approve_deposits, auto_approve_deposit_limit) VALUES
(1, 'Visa/Mastercard', 'credit_card', 'active', 5, 5000, 10, 2000, 10000, 2.9, 0.30, 3.5, 0.50, true, true, 1000),
(2, 'PayPal', 'e_wallet', 'active', 10, 3000, 25, 1500, 5000, 3.5, 0.49, 2.9, 0.30, true, true, 500),
(3, 'Bitcoin', 'crypto', 'active', 25, 10000, 50, 5000, 25000, 1.0, 0, 0.5, 0, false, true, 2000),
(4, 'Square Cash', 'e_wallet', 'active', 1, 2500, 50, 5000, 10000, 2.5, 0.30, 0, 0, true, true, 1000),
(5, 'CashApp', 'e_wallet', 'active', 1, 10000, 100, 5000, 20000, 0, 0, 2.1, 5.00, true, false, 0),
(6, 'Bank Transfer (ACH)', 'bank_transfer', 'active', 25, 50000, 100, 25000, 50000, 0, 0, 0, 0, true, false, 0)
ON CONFLICT DO NOTHING;

-- Insert default banking settings
INSERT INTO banking_settings (setting_key, setting_value, description) VALUES
('auto_approval', '{"deposits":{"enabled":true,"max_amount":1000},"withdrawals":{"enabled":false,"max_amount":500}}', 'Auto-approval settings for deposits and withdrawals'),
('kyc_requirements', '{"level":"enhanced","require_documents":true,"deposit_limit_no_kyc":100}', 'KYC verification requirements'),
('fraud_detection', '{"enabled":true,"risk_threshold":75,"velocity_checks":true,"blocked_countries":["CN","RU","KP"]}', 'Fraud detection and prevention settings'),
('compliance', '{"aml_enabled":true,"sanctions_checking":true,"reporting_threshold":10000,"record_retention":7}', 'Compliance and regulatory settings'),
('notifications', '{"large_transactions":{"enabled":true,"threshold":5000},"failed_transactions":true,"chargebacks":true}', 'Transaction notification settings')
ON CONFLICT (setting_key) DO NOTHING;
