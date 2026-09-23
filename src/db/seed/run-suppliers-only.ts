import { db } from "../index";
import { suppliers } from "../schema";

export async function seedSuppliers(organizationId: string) {
  const seededSuppliers = await db
    .insert(suppliers)
    .values([
      {
        organizationId,
        name: "ABC Distributors",
        panVatNumber: "600112233",
        address: "New Road, Kathmandu",
        phone: "9841000001",
        email: "sales@abcdistributors.com.np",
        paymentTerms: "Net 30",
        status: true,
      },
      {
        organizationId,
        name: "MedSupply Pvt. Ltd.",
        panVatNumber: "600223344",
        address: "Putalisadak, Kathmandu",
        phone: "9841000002",
        email: "contact@medsupply.com.np",
        paymentTerms: "Net 15",
        status: true,
      },
      {
        organizationId,
        name: "City Pharma Distributors",
        panVatNumber: "600334455",
        address: "Baneshwor, Kathmandu",
        phone: "9841000003",
        email: "info@citypharmadist.com.np",
        paymentTerms: "Cash on Delivery",
        status: true,
      },
    ])
    .returning();

  console.log(`Seeded ${seededSuppliers.length} suppliers:`);
  seededSuppliers.forEach((s) => console.log(`  - ${s.name} (${s.id})`));

  return seededSuppliers;
}

const ORGANIZATION_ID = "23594875-8665-48bd-9dd0-dae26fb7366b";

async function run() {
  console.log(`Seeding suppliers for organization: ${ORGANIZATION_ID}`);
  await seedSuppliers(ORGANIZATION_ID);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Supplier seed failed:", err);
    process.exit(1);
  });