import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Abstract IMS",
    short_name: "Abstract IMS",
    description: "Pharmacy stock, sales and expiry tracking",
    start_url: "/pharma",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#044d73",
    icons: [
      { src: "/icon/192x192%20Ims.png", sizes: "192x192", type: "image/png" },
      { src: "/icon/512%20ims%20logo.png", sizes: "512x512", type: "image/png" },
      { src: "/icon/512%20ims%20logo.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}