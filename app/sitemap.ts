import type { MetadataRoute } from "next";
import { getCourses, getUniversities, searchMaterials } from "@/lib/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://push-palestine.vercel.app").replace(
    /\/+$/,
    ""
  );

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/browse`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    {
      url: `${baseUrl}/universities`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/doctors`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  try {
    const [universities, courses, materialsRes] = await Promise.all([
      getUniversities().catch(() => []),
      getCourses().catch(() => []),
      searchMaterials({ pageSize: 100 }).catch(() => ({ items: [], count: 0 })),
    ]);

    const uniRoutes: MetadataRoute.Sitemap = universities.map((u) => ({
      url: `${baseUrl}/universities/${u.id}`,
      lastModified: u.created_at ? new Date(u.created_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    const courseRoutes: MetadataRoute.Sitemap = courses.map((c) => ({
      url: `${baseUrl}/universities/${c.university_id}/${c.id}`,
      lastModified: c.created_at ? new Date(c.created_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    const materialRoutes: MetadataRoute.Sitemap = materialsRes.items.map((m) => ({
      url: `${baseUrl}/material/${m.id}`,
      lastModified: m.created_at ? new Date(m.created_at) : new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    }));

    return [...staticRoutes, ...uniRoutes, ...courseRoutes, ...materialRoutes];
  } catch {
    return staticRoutes;
  }
}
