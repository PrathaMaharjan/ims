import { cloudinary } from "./config";

interface UploadResult {
  url: string;
  publicId: string;
}

export async function uploadOrganizationLogo(
  organizationId: string,
  fileDataUri: string
): Promise<UploadResult> {
  const result = await cloudinary.uploader.upload(fileDataUri, {
    folder: `pharma-system/organizations/${organizationId}`,
    public_id: "logo",
    overwrite: true, 
    resource_type: "image",
    transformation: [{ width: 512, height: 512, crop: "limit" }], 
  });

  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteOrganizationLogo(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}