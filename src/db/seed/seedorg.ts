import { hashPassword } from "@/lib/auth/password";
import { db } from "..";
import { organizations, users } from "../schema";


async function seed() {
  console.log("Seeding organization and owner user...");

  const [org] = await db
    .insert(organizations)
    .values({
      businessName: "pharma",
      panVatNumber: "301234567",
      vatRegistered: true,
      address: "Kathmandu, Nepal",
      phone: "9800000000",
      email: "info@citypharmacy.com",
    })
    .returning();

  const passwordHash = await hashPassword("Password123");

  const [owner] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      name: "Sophan",
      email: "owner@gmail.com",
      passwordHash,
      isOwner: true,
    })
    .returning();

  console.log("Seeded organization:", org.id);
  console.log("Seeded owner user:", owner.id, owner.email);
  console.log("Login with: owner@gmail.com / Password123");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });