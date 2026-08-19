import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/local-admin/"],
    },
    sitemap: "https://civitas-frontend-nvp6.onrender.com/sitemap.xml",
  };
}
