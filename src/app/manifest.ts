import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Raaste — Parking-Congestion Intelligence",
    short_name: "Raaste",
    description:
      "Parking-congestion intelligence for Bengaluru Traffic Police — hotspots, impact scoring and patrol plans on real BTP data.",
    start_url: "/",
    display: "standalone",
    background_color: "#070b14",
    theme_color: "#070b14",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
