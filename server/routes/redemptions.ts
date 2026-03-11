import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import databaseService from '../services/database.js';

const router = express.Router();

// Constants
const MIN_REDEMPTION_BALANCE = 100; // 100 SC minimum
const BANK_WITHDRAWAL_FEE = 0; // Free
const CASHAPP_WITHDRAWAL_FEE = 5; // $5 fee

// Get redemption requirements and limits
router.get('/requirements', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Get user balance
    const balanceResult = await databaseService.query(
      `SELECT * FROM user_balances WHERE user_id = $1 AND currency = 'SC'`,
      [user.id]
    );
    
    const balance = balanceResult.rows[0]?.balance || 0;
    const kycStatus = user.kyc_status || 'pending';
    
    res.json({
      success: true,
      requirements: {
        minimumBalance: MIN_REDEMPTION_BALANCE,
        currentBalance: balance,
        kycRequired: true,
        kycStatus: kycStatus,
        isEligible: balance >= MIN_REDEMPTION_BALANCE && kycStatus === 'verified',
        eligibilityChecks: {
          balanceCheck: balance >= MIN_REDEMPTION_BALANCE,
          kycCheck: kycStatus === 'verified'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching redemption requirements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch redemption requirements'
    });
  }
});

// Request redemption/cashout
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { amount, method, bankAccountId, cashappHandle } = req.body;

    // Validate inputs
    if (!amount || !method) {
      return res.status(400).json({
        success: false,
        error: 'Amount and payment method are required'
      });
    }

    if (!['bank', 'cashapp'].includes(method)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment method. Must be "bank" or "cashapp"'
      });
    }

    // Get user balance
    const balanceResult = await databaseService.query(
      `SELECT * FROM user_balances WHERE user_id = $1 AND currency = 'SC'`,
      [user.id]
    );

    const balance = balanceResult.rows[0]?.balance || 0;

    // Check minimum balance
    if (balance < MIN_REDEMPTION_BALANCE) {
      return res.status(400).json({
        success: false,
        error: `Minimum balance of ${MIN_REDEMPTION_BALANCE} SC required for redemption`,
        currentBalance: balance,
        shortBy: MIN_REDEMPTION_BALANCE - balance
      });
    }

    // Check KYC verification
    const userResult = await databaseService.query(
      `SELECT kyc_status FROM users WHERE id = $1`,
      [user.id]
    );

    const kycStatus = userResult.rows[0]?.kyc_status;
    if (kycStatus !== 'verified') {
      return res.status(403).json({
        success: false,
        error: 'KYC verification required before redemption',
        kycStatus: kycStatus
      });
    }

    // Check redemption amount
    if (amount < 100 || amount > 5000) {
      return res.status(400).json({
        success: false,
        error: 'Redemption amount must be between 100 SC and 5000 SC'
      });
    }

    if (amount > balance) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance for redemption',
        currentBalance: balance,
        requestedAmount: amount
      });
    }

    // Calculate fees
    const fee = method === 'cashapp' ? CASHAPP_WITHDRAWAL_FEE : BANK_WITHDRAWAL_FEE;
    const netAmount = amount - fee;

    // Begin transaction
    const client = await (databaseService as any).pool?.connect?.();
    if (!client) {
      return res.status(500).json({
        success: false,
        error: 'Database connection error'
      });
    }

    try {
      await client.query('BEGIN');

      // Update user balance
      await client.query(
        `UPDATE user_balances 
         SET balance = balance - $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND currency = 'SC'`,
        [amount, user.id]
      );

      // Create banking transaction
      const transactionResult = await client.query(
        `INSERT INTO banking_transactions 
         (transaction_id, user_id, type, status, amount, currency, fee_amount, net_amount, payment_details, aml_status, requires_manual_approval, user_ip)
         VALUES ($1, $2, 'withdrawal', 'pending', $3, 'USD', $4, $5, $6, 'pending', true, $7)
         RETURNING id, transaction_id`,
        [
          `redemption_${Date.now()}_${user.id}`,
          user.id,
          amount,
          fee,
          netAmount,
          JSON.stringify({
            method: method,
            bankAccountId: method === 'bank' ? bankAccountId : null,
            cashappHandle: method === 'cashapp' ? cashappHandle : null
          }),
          req.ip || 'unknown'
        ]
      );

      // Create withdrawal request
      const withdrawalResult = await client.query(
        `INSERT INTO withdrawal_requests 
         (user_id, transaction_id, amount, currency, method, destination_details, status, requires_approval, processing_fee, net_amount, kyc_required)
         VALUES ($1, $2, $3, 'USD', $4, $5, 'pending', true, $6, $7, false)
         RETURNING id`,
        [
          user.id,
          transactionResult.rows[0].id,
          amount,
          method,
          JSON.stringify({
            method: method,
            bankAccountId: method === 'bank' ? bankAccountId : null,
            cashappHandle: method === 'cashapp' ? cashappHandle : null
          }),
          fee,
          netAmount
        ]
      );

      // Create transaction record
      await client.query(
        `INSERT INTO transactions 
         (user_id, transaction_type, currency, amount, balance_before, balance_after, description, status)
         VALUES ($1, 'withdrawal', 'SC', $2, $3, $4, $5, 'completed')`,
        [
          user.id,
          amount,
          balance,
          balance - amount,
          `Redemption: ${amount} SC to ${method} (Fee: ${fee})`
        ]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Redemption request submitted successfully',
        redemption: {
          id: withdrawalResult.rows[0].id,
          transactionId: transactionResult.rows[0].transaction_id,
          amount: amount,
          fee: fee,
          netAmount: netAmount,
          method: method,
          status: 'pending_approval',
          createdAt: new Date()
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error processing redemption request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process redemption request'
    });
  }
});

// Get user's redemption history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { limit = 50, offset = 0 } = req.query;

    const result = await databaseService.query(
      `SELECT 
        wr.id,
        wr.amount,
        wr.currency,
        wr.method,
        wr.status,
        wr.processing_fee as fee,
        wr.net_amount,
        wr.created_at,
        wr.completed_at,
        bt.aml_status
       FROM withdrawal_requests wr
       LEFT JOIN banking_transactions bt ON wr.transaction_id = bt.id
       WHERE wr.user_id = $1
       ORDER BY wr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching redemption history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch redemption history'
    });
  }
});

// Admin: Get pending redemption requests
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check if admin
    const adminCheck = await databaseService.query(
      `SELECT role FROM users WHERE id = $1`,
      [user.id]
    );

    if (adminCheck.rows[0]?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const result = await databaseService.query(
      `SELECT 
        wr.id,
        wr.user_id,
        u.email,
        u.username,
        u.first_name,
        u.last_name,
        wr.amount,
        wr.currency,
        wr.method,
        wr.status,
        wr.processing_fee as fee,
        wr.net_amount,
        wr.destination_details,
        wr.created_at,
        u.kyc_status,
        ub.balance
       FROM withdrawal_requests wr
       JOIN users u ON wr.user_id = u.id
       LEFT JOIN user_balances ub ON u.id = ub.user_id AND ub.currency = 'SC'
       WHERE wr.status IN ('pending', 'processing')
       ORDER BY wr.created_at ASC`
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching pending redemptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending redemptions'
    });
  }
});

// Admin: Approve redemption request
router.post('/approve/:requestId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { requestId } = req.params;

    // Check if admin
    const adminCheck = await databaseService.query(
      `SELECT role FROM users WHERE id = $1`,
      [user.id]
    );

    if (adminCheck.rows[0]?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    // Get withdrawal request details
    const withdrawalResult = await databaseService.query(
      `SELECT wr.*, u.email 
       FROM withdrawal_requests wr
       JOIN users u ON wr.user_id = u.id
       WHERE wr.id = $1`,
      [requestId]
    );

    if (withdrawalResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Redemption request not found'
      });
    }

    const withdrawal = withdrawalResult.rows[0];

    // Update status
    await databaseService.query(
      `UPDATE withdrawal_requests 
       SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [user.id, requestId]
    );

    // Update banking transaction status
    await databaseService.query(
      `UPDATE banking_transactions 
       SET status = 'processing', processed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [withdrawal.transaction_id]
    );

    res.json({
      success: true,
      message: 'Redemption request approved',
      data: {
        requestId: requestId,
        status: 'approved',
        userId: withdrawal.user_id,
        userEmail: withdrawal.email,
        amount: withdrawal.amount,
        approvedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error approving redemption request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve redemption request'
    });
  }
});

// Admin: Reject redemption request
router.post('/reject/:requestId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { requestId } = req.params;
    const { reason } = req.body;

    // Check if admin
    const adminCheck = await databaseService.query(
      `SELECT role FROM users WHERE id = $1`,
      [user.id]
    );

    if (adminCheck.rows[0]?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    // Get withdrawal request details
    const withdrawalResult = await databaseService.query(
      `SELECT * FROM withdrawal_requests WHERE id = $1`,
      [requestId]
    );

    if (withdrawalResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Redemption request not found'
      });
    }

    const withdrawal = withdrawalResult.rows[0];

    // Begin transaction
    const client = await (databaseService as any).pool?.connect?.();

    try {
      await client.query('BEGIN');

      // Update withdrawal request status
      await client.query(
        `UPDATE withdrawal_requests 
         SET status = 'rejected', rejection_reason = $1
         WHERE id = $2`,
        [reason || 'Rejected by admin', requestId]
      );

      // Refund the balance
      await client.query(
        `UPDATE user_balances 
         SET balance = balance + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND currency = 'SC'`,
        [withdrawal.amount, withdrawal.user_id]
      );

      // Update banking transaction status
      await client.query(
        `UPDATE banking_transactions 
         SET status = 'cancelled', failure_reason = $1
         WHERE id = $2`,
        [reason || 'Rejected by admin', withdrawal.transaction_id]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Redemption request rejected and balance refunded',
        data: {
          requestId: requestId,
          status: 'rejected',
          refundedAmount: withdrawal.amount
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error rejecting redemption request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject redemption request'
    });
  }
});

// Admin: Mark redemption as completed
router.post('/complete/:requestId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { requestId } = req.params;

    // Check if admin
    const adminCheck = await databaseService.query(
      `SELECT role FROM users WHERE id = $1`,
      [user.id]
    );

    if (adminCheck.rows[0]?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    // Update withdrawal request status
    await databaseService.query(
      `UPDATE withdrawal_requests 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );

    // Update banking transaction status
    await databaseService.query(
      `UPDATE banking_transactions 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = (SELECT transaction_id FROM withdrawal_requests WHERE id = $1)`,
      [requestId]
    );

    res.json({
      success: true,
      message: 'Redemption request marked as completed',
      data: {
        requestId: requestId,
        status: 'completed',
        completedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error completing redemption request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete redemption request'
    });
  }
});

export default router;
