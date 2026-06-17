import type { MetadataRoute } from "next";

const base = "https://raaste.theahmadfaraz.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: base,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${base}/field`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/demo-video`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
