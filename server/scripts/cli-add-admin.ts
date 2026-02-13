import { addAdmin } from "./addAdmin.js";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error(
      "Usage: npx ts-node server/scripts/cli-add-admin.ts <email> <password>"
    );
    process.exit(1);
  }

  console.log(`Adding admin user: ${email}`);
  const result = await addAdmin(email, password);

  if (result.success) {
    console.log("✓ Admin user created successfully!");
    console.log(result.user);
  } else {
    console.error("✗ Failed to add admin user:");
    console.error(result.error);
    console.error(result.details);
  }

  process.exit(result.success ? 0 : 1);
}

main();
