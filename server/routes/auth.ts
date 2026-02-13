import express from "express";
import jwt from "jsonwebtoken";
import databaseService from "../services/database.js";

const router = express.Router();

// Login endpoint
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Get user by email
    const user = await databaseService.getUserByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check if account is active
    if (user.status === "banned") {
      return res.status(403).json({
        success: false,
        message: "Account has been suspended. Contact support."
      });
    }

    // Verify password
    const bcrypt = await import("bcryptjs");
    const passwordValid = await bcrypt.default.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check email verification
    if (!user.is_email_verified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email address before logging in. Check your inbox for the verification link.",
        requiresEmailVerification: true
      });
    }

    // Update last login
    await databaseService.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
      [user.id]
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
      last_login: new Date()
    };

    res.json({
      success: true,
      user: cleanUser,
      token,
      message: "Login successful!"
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again."
    });
  }
});

// Register endpoint
router.post("/register", async (req, res) => {
  try {
    const { email, username, password, firstName, lastName, dateOfBirth } = req.body;

    // Validate input
    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "Email, username, and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
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
          message: "You must be 18 or older to register"
        });
      }
    }

    // Check if email already exists
    const existingEmail = await databaseService.getUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "Email address is already registered"
      });
    }

    // Check if username already exists
    const existingUsername = await databaseService.getUserByUsername(username);
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: "Username is already taken"
      });
    }

    // Hash password
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.default.hash(password, 12);

    // Create user
    const newUser = await databaseService.createUser({
      email: email.toLowerCase(),
      password_hash: passwordHash,
      username: username,
      first_name: firstName,
      last_name: lastName
    });

    res.json({
      success: true,
      message: "Registration successful! Please check your email to verify your account and claim your welcome bonus.",
      requiresEmailVerification: true
    });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again."
    });
  }
});

// Verify email endpoint
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;
    
    const user = await databaseService.verifyEmail(token);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token"
      });
    }

    res.json({
      success: true,
      message: "Email verified successfully! Your welcome bonus has been added to your account."
    });

  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Email verification failed. Please try again."
    });
  }
});

export default router;
