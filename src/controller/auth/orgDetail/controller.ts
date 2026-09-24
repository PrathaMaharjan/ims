import { db } from "@/db";
import { organizations } from "@/db/schema";
import { invalidateCache } from "@/lib/cache";
import { uploadOrganizationLogo } from "@/lib/cloudinary/upload";
import { UpdateOrganizationInput } from "@/lib/validation/organiztion";
import { eq } from "drizzle-orm";

function orgCacheKey(organizationId: string) {
  return `organization:${organizationId}`;
}

const orgColumns = {
  id: organizations.id,
  businessName: organizations.businessName,
  logoUrl: organizations.logoUrl,
  panVatNumber: organizations.panVatNumber,
  vatRegistered: organizations.vatRegistered,
  address: organizations.address,
  phone: organizations.phone,
  email: organizations.email,
};

// get organization details by id, with caching
export async function getOrganization(organizationId: string) {
  const [org] = await db
    .select(orgColumns)
    .from(organizations)
    .where(eq(organizations.id, organizationId));

  if (!org) {
    throw new Error("Organization not found");
  }

  return org;
}
// update organization details by id
export async function updateOrganization(organizationId: string, input: UpdateOrganizationInput) {
  const { logoDataUri, ...fields } = input;

  if (Object.keys(fields).length === 0 && !logoDataUri) {
    throw new Error("Nothing to update");
  }
    const logoUrl = logoDataUri
    ? (await uploadOrganizationLogo(organizationId, logoDataUri)).url
    : undefined;

  const [updated] = await db
    .update(organizations)
    .set({
      ...fields,
      ...(logoUrl ? { logoUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
    .returning(orgColumns);

  if (!updated) {
    throw new Error("Organization not found");
  }

  await invalidateCache(orgCacheKey(organizationId));

  return updated;
}