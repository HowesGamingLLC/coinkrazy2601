import bcryptjs from "bcryptjs";
import databaseService from "../services/database.js";

export async function addAdmin(email: string, password: string) {
  try {
    // Check if admin already exists
    const existingAdmin = await databaseService.getUserByEmail(email);
    if (existingAdmin) {
      return {
        success: true,
        message: "Admin user already exists",
        user: {
          email: existingAdmin.email,
          username: existingAdmin.username,
          role: existingAdmin.role,
        },
      };
    }

    // Hash password
    const passwordHash = await bcryptjs.hash(password, 12);

    // Create admin user
    const adminUser = await databaseService.createUser({
      email: email,
      password_hash: passwordHash,
      username: email.split("@")[0],
      first_name: "Admin",
      last_name: "User",
    });

    // Update user to admin role and verify email
    await databaseService.query(
      `UPDATE users 
       SET role = 'admin', 
           is_email_verified = TRUE, 
           email_verification_token = NULL,
           status = 'active'
       WHERE id = $1`,
      [adminUser.id]
    );

    return {
      success: true,
      message: "Admin user created successfully",
      user: {
        email: adminUser.email,
        username: email.split("@")[0],
        role: "admin",
      },
    };
  } catch (error) {
    console.error("Error adding admin user:", error);
    return {
      success: false,
      error: "Failed to add admin user",
      details: error.message,
    };
  }
}
