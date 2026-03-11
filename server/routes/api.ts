import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import databaseService from "../services/database.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import bankingRoutes from "./banking.js";
import scratchCardRoutes from "./scratchCards.js";
import redemptionRoutes from "./redemptions.js";

const router = express.Router();

// Mount banking routes
router.use("/banking", bankingRoutes);

// Mount scratch card routes
router.use("/scratch-cards", scratchCardRoutes);

// Mount redemption routes
router.use("/redemptions", redemptionRoutes);

// Authentication endpoints
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Get user by email
    const user = await databaseService.getUserByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if account is active
    if (user.status === "banned") {
      return res.status(403).json({
        success: false,
        message: "Account has been suspended. Contact support.",
      });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check email verification
    if (!user.is_email_verified) {
      return res.status(403).json({
        success: false,
        message:
          "Please verify your email address before logging in. Check your inbox for the verification link.",
        requiresEmailVerification: true,
      });
    }

    // Update last login
    await databaseService.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
      [user.id],
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    // Clean user object (remove sensitive data)
    const cleanUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      status: user.status,
      kyc_status: user.kyc_status,
      is_email_verified: user.is_email_verified,
      vip_expires_at: user.vip_expires_at,
      created_at: user.created_at,
      last_login: new Date(),
      isLoggedIn: true,
      isAdmin: user.role === "admin",
    };

    res.json({
      success: true,
      user: cleanUser,
      token,
      message: "Login successful!",
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
});

router.post("/auth/register", async (req, res) => {
  try {
    const { email, username, password, firstName, lastName, dateOfBirth } =
      req.body;

    // Validate input
    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "Email, username, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Check age requirement (18+)
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 18) {
        return res.status(400).json({
          success: false,
          message: "You must be 18 or older to register",
        });
      }
    }

    // Check if email already exists
    const existingEmail = await databaseService.getUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "Email address is already registered",
      });
    }

    // Check if username already exists
    const existingUsername = await databaseService.getUserByUsername(username);
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: "Username is already taken",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const newUser = await databaseService.createUser({
      email: email.toLowerCase(),
      password_hash: passwordHash,
      username: username,
      first_name: firstName,
      last_name: lastName,
    });

    res.json({
      success: true,
      message:
        "Registration successful! Please check your email to verify your account and claim your welcome bonus.",
      requiresEmailVerification: true,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
});

// User management endpoints
router.post("/users", async (req, res) => {
  try {
    const user = await databaseService.createUser(req.body);
    res.json(user);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.get("/users/email/:email", async (req, res) => {
  try {
    const user = await databaseService.getUserByEmail(req.params.email);
    res.json(user);
  } catch (error) {
    console.error("Error getting user by email:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

router.get("/users/username/:username", async (req, res) => {
  try {
    const user = await databaseService.getUserByUsername(req.params.username);
    res.json(user);
  } catch (error) {
    console.error("Error getting user by username:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

router.post("/users/verify-email", async (req, res) => {
  try {
    const user = await databaseService.verifyEmail(req.body.token);
    res.json(user);
  } catch (error) {
    console.error("Error verifying email:", error);
    res.status(500).json({ error: "Failed to verify email" });
  }
});

// Balance management endpoints
router.get("/balances/:userId", async (req, res) => {
  try {
    const balance = await databaseService.getUserBalance(
      parseInt(req.params.userId),
    );
    res.json(balance);
  } catch (error) {
    console.error("Error getting user balance:", error);
    res.status(500).json({ error: "Failed to get balance" });
  }
});

router.post("/balances/:userId/update", async (req, res) => {
  try {
    const { gcChange, scChange, description, gameId } = req.body;
    const balance = await databaseService.updateUserBalance(
      parseInt(req.params.userId),
      gcChange,
      scChange,
      description,
      gameId,
    );
    res.json(balance);
  } catch (error) {
    console.error("Error updating balance:", error);
    res.status(500).json({ error: "Failed to update balance" });
  }
});

// Game management endpoints
router.get("/games", async (req, res) => {
  try {
    const games = await databaseService.getAllGames();
    res.json(games);
  } catch (error) {
    console.error("Error getting games:", error);
    res.status(500).json({ error: "Failed to get games" });
  }
});

router.get("/games/active", async (req, res) => {
  try {
    const games = await databaseService.getActiveGames();
    res.json(games);
  } catch (error) {
    console.error("Error getting active games:", error);
    res.status(500).json({ error: "Failed to get active games" });
  }
});

router.post("/games/:gameId/stats", async (req, res) => {
  try {
    const { profitGC, profitSC } = req.body;
    const game = await databaseService.updateGameStats(
      req.params.gameId,
      profitGC,
      profitSC,
    );
    res.json(game);
  } catch (error) {
    console.error("Error updating game stats:", error);
    res.status(500).json({ error: "Failed to update game stats" });
  }
});

// Game management endpoints (admin only)
router.patch("/games/:gameId", requireAdmin, async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const { is_active, is_featured, rtp } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    if (is_featured !== undefined) {
      updates.push(`is_featured = $${paramCount}`);
      values.push(is_featured);
      paramCount++;
    }

    if (rtp !== undefined) {
      updates.push(`rtp = $${paramCount}`);
      values.push(rtp);
      paramCount++;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(gameId);

    const query = `
      UPDATE games
      SET ${updates.join(", ")}
      WHERE game_id = $${paramCount}
      RETURNING *
    `;

    const result = await databaseService.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Game not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating game:", error);
    res.status(500).json({ error: "Failed to update game" });
  }
});

// Admin endpoints
router.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const users = await databaseService.getAllUsers(limit, offset);
    res.json(users);
  } catch (error) {
    console.error("Error getting all users:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
});

router.get("/admin/transactions", requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const transactions = await databaseService.getRecentTransactions(limit);
    res.json(transactions);
  } catch (error) {
    console.error("Error getting transactions:", error);
    res.status(500).json({ error: "Failed to get transactions" });
  }
});

router.get("/admin/stats", requireAdmin, async (req, res) => {
  try {
    const stats = await databaseService.getLiveStats();
    res.json(stats);
  } catch (error) {
    console.error("Error getting live stats:", error);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

router.post("/admin/stats/:statName", requireAdmin, async (req, res) => {
  try {
    const { value, metadata } = req.body;
    const stat = await databaseService.updateLiveStat(
      req.params.statName,
      value,
      metadata,
    );
    res.json(stat);
  } catch (error) {
    console.error("Error updating stat:", error);
    res.status(500).json({ error: "Failed to update stat" });
  }
});

// User management endpoints (admin only)
router.patch("/users/:userId", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { status, kyc_status, first_name, last_name } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (kyc_status !== undefined) {
      updates.push(`kyc_status = $${paramCount}`);
      values.push(kyc_status);
      paramCount++;
    }

    if (first_name !== undefined) {
      updates.push(`first_name = $${paramCount}`);
      values.push(first_name);
      paramCount++;
    }

    if (last_name !== undefined) {
      updates.push(`last_name = $${paramCount}`);
      values.push(last_name);
      paramCount++;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${paramCount}
      RETURNING id, email, username, status, kyc_status, first_name, last_name, role, created_at, updated_at
    `;

    const result = await databaseService.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/users/:userId", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    // Soft delete - set status to banned instead of actually deleting
    const query = `
      UPDATE users
      SET status = 'banned', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, username, status
    `;

    const result = await databaseService.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, message: "User deleted successfully", user: result.rows[0] });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// AI Employee endpoints (admin only)
router.get("/ai-employees", requireAdmin, async (req, res) => {
  try {
    const employees = await databaseService.getAIEmployees();
    res.json(employees);
  } catch (error) {
    console.error("Error getting AI employees:", error);
    res.status(500).json({ error: "Failed to get AI employees" });
  }
});

router.post("/ai-employees/:id/metrics", requireAdmin, async (req, res) => {
  try {
    const { tasksCompleted, moneySaved } = req.body;
    const employee = await databaseService.updateAIEmployeeMetrics(
      parseInt(req.params.id),
      tasksCompleted,
      moneySaved,
    );
    res.json(employee);
  } catch (error) {
    console.error("Error updating AI employee metrics:", error);
    res.status(500).json({ error: "Failed to update metrics" });
  }
});

// Notification endpoints (admin only)
router.post("/notifications", requireAdmin, async (req, res) => {
  try {
    const { title, message, type, fromAI, actionRequired, actionUrl } =
      req.body;
    const notification = await databaseService.createAdminNotification(
      title,
      message,
      type,
      fromAI,
      actionRequired,
      actionUrl,
    );
    res.json(notification);
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ error: "Failed to create notification" });
  }
});

router.get("/notifications/unread", requireAdmin, async (req, res) => {
  try {
    const notifications = await databaseService.getUnreadNotifications();
    res.json(notifications);
  } catch (error) {
    console.error("Error getting unread notifications:", error);
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

router.post("/notifications/:id/read", requireAdmin, async (req, res) => {
  try {
    const notification = await databaseService.markNotificationRead(
      parseInt(req.params.id),
    );
    res.json(notification);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// ===== ENHANCED GOLD STORE ENDPOINTS =====

// Coin package endpoints (enhanced)
router.get("/coin-packages", async (req, res) => {
  try {
    const packages = await databaseService.getCoinPackages();
    res.json(packages);
  } catch (error) {
    console.error("Error getting coin packages:", error);
    res.status(500).json({ error: "Failed to get coin packages" });
  }
});

router.get("/coin-packages/:id", async (req, res) => {
  try {
    const packageId = parseInt(req.params.id);
    const query = "SELECT * FROM coin_packages WHERE id = $1";
    const result = await databaseService.query(query, [packageId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Package not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error getting coin package:", error);
    res.status(500).json({ error: "Failed to get coin package" });
  }
});

router.post("/coin-packages", requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      gold_coins,
      sweeps_coins,
      bonus_gold_coins,
      bonus_sweeps_coins,
      price_usd,
      is_active,
      sort_order,
    } = req.body;

    const query = `
      INSERT INTO coin_packages (
        name, description, gold_coins, sweeps_coins,
        bonus_gold_coins, bonus_sweeps_coins, price_usd,
        is_active, sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await databaseService.query(query, [
      name,
      description,
      gold_coins || 0,
      sweeps_coins || 0,
      bonus_gold_coins || 0,
      bonus_sweeps_coins || 0,
      price_usd,
      is_active !== undefined ? is_active : true,
      sort_order || 0,
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating coin package:", error);
    res.status(500).json({ error: "Failed to create coin package" });
  }
});

router.patch("/coin-packages/:id", requireAdmin, async (req, res) => {
  try {
    const packageId = parseInt(req.params.id);
    const updates = req.body;

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined && key !== "id") {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const query = `
      UPDATE coin_packages 
      SET ${updateFields.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    values.push(packageId);
    const result = await databaseService.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Package not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating coin package:", error);
    res.status(500).json({ error: "Failed to update coin package" });
  }
});

router.delete("/coin-packages/:id", requireAdmin, async (req, res) => {
  try {
    const packageId = parseInt(req.params.id);
    const query = "DELETE FROM coin_packages WHERE id = $1 RETURNING *";
    const result = await databaseService.query(query, [packageId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Package not found" });
    }

    res.json({ success: true, message: "Package deleted successfully" });
  } catch (error) {
    console.error("Error deleting coin package:", error);
    res.status(500).json({ error: "Failed to delete coin package" });
  }
});

// Purchase processing
router.post("/purchase-package", async (req, res) => {
  try {
    const { packageId, paymentMethod, userId } = req.body;

    // Get package details
    const packageQuery =
      "SELECT * FROM coin_packages WHERE id = $1 AND is_active = TRUE";
    const packageResult = await databaseService.query(packageQuery, [
      packageId,
    ]);

    if (packageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Package not found or inactive",
      });
    }

    const coinPackage = packageResult.rows[0];

    // Mock payment processing (in production, integrate with payment processor)
    const isPaymentSuccessful = Math.random() > 0.1; // 90% success rate

    if (!isPaymentSuccessful) {
      return res.status(400).json({
        success: false,
        error: "Payment processing failed",
      });
    }

    // Calculate total coins to add
    const totalGoldCoins =
      coinPackage.gold_coins + (coinPackage.bonus_gold_coins || 0);
    const totalSweepsCoins =
      coinPackage.sweeps_coins + (coinPackage.bonus_sweeps_coins || 0);

    // Create transaction record
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // For demo purposes, use a default user ID if not provided
    const targetUserId = userId || 1; // Default to admin user

    try {
      // Update user balance (if userId provided)
      if (userId) {
        await databaseService.updateUserBalance(
          targetUserId,
          totalGoldCoins / 1000, // Convert to correct units
          totalSweepsCoins,
          `Purchase: ${coinPackage.name}`,
          "store_purchase",
        );
      }

      // Record purchase transaction
      const purchaseQuery = `
        INSERT INTO transactions (
          user_id, transaction_type, currency, amount, 
          description, status, payment_method, payment_reference
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const purchaseResult = await databaseService.query(purchaseQuery, [
        targetUserId,
        "deposit",
        "USD",
        coinPackage.price_usd,
        `Gold Store Purchase: ${coinPackage.name}`,
        "completed",
        paymentMethod,
        transactionId,
      ]);

      res.json({
        success: true,
        transaction: purchaseResult.rows[0],
        package: coinPackage,
        coinsAdded: {
          goldCoins: totalGoldCoins,
          sweepsCoins: totalSweepsCoins,
        },
        message: "Purchase completed successfully!",
      });
    } catch (balanceError) {
      console.error("Error updating balance:", balanceError);
      // Still return success for the purchase, balance update can be handled separately
      res.json({
        success: true,
        transaction: { id: transactionId },
        package: coinPackage,
        coinsAdded: {
          goldCoins: totalGoldCoins,
          sweepsCoins: totalSweepsCoins,
        },
        message: "Purchase completed successfully!",
      });
    }
  } catch (error) {
    console.error("Error processing purchase:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process purchase",
    });
  }
});

// Purchase history
router.get("/purchase-history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const userId = req.query.userId as string;

    let query = `
      SELECT t.*, u.username, u.email
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.transaction_type = 'deposit' AND t.description LIKE 'Gold Store Purchase:%'
    `;
    const params = [];

    if (userId) {
      query += ` AND t.user_id = $1`;
      params.push(parseInt(userId));
      query += ` ORDER BY t.created_at DESC LIMIT $2`;
      params.push(limit);
    } else {
      query += ` ORDER BY t.created_at DESC LIMIT $1`;
      params.push(limit);
    }

    const result = await databaseService.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Error getting purchase history:", error);
    res.status(500).json({ error: "Failed to get purchase history" });
  }
});

// Store analytics
router.get("/store-analytics", async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Get basic sales stats
    const salesQuery = `
      SELECT 
        COUNT(*) as total_sales,
        SUM(amount) as total_revenue,
        AVG(amount) as average_order_value
      FROM transactions
      WHERE transaction_type = 'deposit' 
        AND description LIKE 'Gold Store Purchase:%'
        AND created_at >= $1
    `;

    const salesResult = await databaseService.query(salesQuery, [fromDate]);
    const stats = salesResult.rows[0];

    // Get top packages
    const topPackagesQuery = `
      SELECT 
        SUBSTRING(description FROM 'Gold Store Purchase: (.+)') as package_name,
        COUNT(*) as sales,
        SUM(amount) as revenue
      FROM transactions
      WHERE transaction_type = 'deposit' 
        AND description LIKE 'Gold Store Purchase:%'
        AND created_at >= $1
      GROUP BY package_name
      ORDER BY revenue DESC
      LIMIT 5
    `;

    const topPackagesResult = await databaseService.query(topPackagesQuery, [
      fromDate,
    ]);

    // Mock additional analytics data
    const analytics = {
      totalRevenue: parseFloat(stats.total_revenue) || 0,
      totalSales: parseInt(stats.total_sales) || 0,
      conversionRate: 8.5,
      averageOrderValue: parseFloat(stats.average_order_value) || 0,
      topPackages: topPackagesResult.rows.map((row) => ({
        packageId: row.package_name,
        name: row.package_name,
        sales: parseInt(row.sales),
        revenue: parseFloat(row.revenue),
      })),
      salesByPeriod: [], // Could be implemented with more complex query
      paymentMethodStats: [
        { method: "credit_card", count: 450, percentage: 60.0 },
        { method: "paypal", count: 180, percentage: 24.0 },
        { method: "apple_pay", count: 75, percentage: 10.0 },
        { method: "google_pay", count: 45, percentage: 6.0 },
      ],
      userDemographics: {
        newUsers: 123,
        returningUsers: 456,
        vipUsers: 78,
      },
      performanceMetrics: {
        pageViews: 5432,
        cartAbandonment: 12.5,
        refundRate: 1.8,
      },
    };

    res.json(analytics);
  } catch (error) {
    console.error("Error getting store analytics:", error);
    res.status(500).json({ error: "Failed to get store analytics" });
  }
});

// Store settings
router.get("/store-settings", async (req, res) => {
  try {
    // For now, return mock settings. In production, this would come from a settings table
    const settings = {
      storeName: "CoinKrazy Gold Store",
      storeDescription: "Premium gold coins and sweeps coins packages",
      defaultCurrency: "USD",
      taxRate: 0,
      enabledPaymentMethods: [
        "credit_card",
        "paypal",
        "apple_pay",
        "google_pay",
      ],
      minimumPurchaseAmount: 4.99,
      maximumPurchaseAmount: 999.99,
      maintenanceMode: false,
      maintenanceMessage: "",
    };

    res.json(settings);
  } catch (error) {
    console.error("Error getting store settings:", error);
    res.status(500).json({ error: "Failed to get store settings" });
  }
});

router.patch("/store-settings", async (req, res) => {
  try {
    // For now, just return the updated settings. In production, save to database
    const currentSettings = {
      storeName: "CoinKrazy Gold Store",
      storeDescription: "Premium gold coins and sweeps coins packages",
      defaultCurrency: "USD",
      taxRate: 0,
      enabledPaymentMethods: [
        "credit_card",
        "paypal",
        "apple_pay",
        "google_pay",
      ],
      minimumPurchaseAmount: 4.99,
      maximumPurchaseAmount: 999.99,
      maintenanceMode: false,
      maintenanceMessage: "",
    };

    const updatedSettings = { ...currentSettings, ...req.body };
    res.json(updatedSettings);
  } catch (error) {
    console.error("Error updating store settings:", error);
    res.status(500).json({ error: "Failed to update store settings" });
  }
});

// Daily wheel spin endpoints
router.get("/wheel-spins/:userId", async (req, res) => {
  try {
    const date = req.query.date as string;
    const spin = await databaseService.getDailyWheelSpin(
      parseInt(req.params.userId),
      date,
    );
    res.json(spin);
  } catch (error) {
    console.error("Error getting wheel spin:", error);
    res.status(500).json({ error: "Failed to get wheel spin" });
  }
});

router.post("/wheel-spins/:userId", async (req, res) => {
  try {
    const { scWon } = req.body;
    const spin = await databaseService.createWheelSpin(
      parseInt(req.params.userId),
      scWon,
    );
    res.json(spin);
  } catch (error) {
    console.error("Error creating wheel spin:", error);
    res.status(500).json({ error: "Failed to create wheel spin" });
  }
});

// CMS Endpoints (Admin only)
router.get("/cms/pages", requireAdmin, async (req, res) => {
  try {
    const query = "SELECT * FROM cms_pages WHERE deleted_at IS NULL ORDER BY updated_at DESC";
    const result = await databaseService.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error getting CMS pages:", error);
    res.status(500).json({ error: "Failed to get CMS pages" });
  }
});

router.post("/cms/pages", requireAdmin, async (req, res) => {
  try {
    const { slug, title, content, published } = req.body;
    const query = `
      INSERT INTO cms_pages (slug, title, content, published)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await databaseService.query(query, [slug, title, content, published !== false]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating CMS page:", error);
    res.status(500).json({ error: "Failed to create CMS page" });
  }
});

router.patch("/cms/pages/:id", requireAdmin, async (req, res) => {
  try {
    const { slug, title, content, published } = req.body;
    const query = `
      UPDATE cms_pages
      SET slug = COALESCE($1, slug), title = COALESCE($2, title),
          content = COALESCE($3, content), published = COALESCE($4, published),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `;
    const result = await databaseService.query(query, [slug, title, content, published, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Page not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating CMS page:", error);
    res.status(500).json({ error: "Failed to update CMS page" });
  }
});

// Admin Role Management Endpoints (Super admin only)
router.patch("/users/:userId/role", requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;

    // Validate role
    if (!["user", "staff", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const query = `
      UPDATE users
      SET role = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, username, role
    `;
    const result = await databaseService.query(query, [role, req.params.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ error: "Failed to update user role" });
  }
});

// KYC/Compliance Endpoints (Admin only)
router.get("/kyc/pending", requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT id, email, username, kyc_status, kyc_documents, created_at
      FROM users
      WHERE kyc_status = 'pending' OR kyc_status = 'submitted'
      ORDER BY created_at DESC
      LIMIT 100
    `;
    const result = await databaseService.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error getting pending KYC:", error);
    res.status(500).json({ error: "Failed to get pending KYC requests" });
  }
});

router.patch("/kyc/:userId/approve", requireAdmin, async (req, res) => {
  try {
    const query = `
      UPDATE users
      SET kyc_status = 'verified', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, username, kyc_status
    `;
    const result = await databaseService.query(query, [req.params.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error approving KYC:", error);
    res.status(500).json({ error: "Failed to approve KYC" });
  }
});

router.patch("/kyc/:userId/reject", requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const query = `
      UPDATE users
      SET kyc_status = 'rejected', kyc_documents = jsonb_set(kyc_documents, '{rejection_reason}', $1::jsonb),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, username, kyc_status
    `;
    const result = await databaseService.query(query, [JSON.stringify({ reason }), req.params.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error rejecting KYC:", error);
    res.status(500).json({ error: "Failed to reject KYC" });
  }
});

export default router;
