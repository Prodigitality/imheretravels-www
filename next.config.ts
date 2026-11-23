import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { getAllTourSlugs } from "./data/tours";
import publicAssets from "./data/public-assets.json";

// Safeguard: without NEXT_PUBLIC_GTM_ID a build ships with no Tag Manager, no
// cookie banner and no Meta pixel, and nothing else looks wrong. That happened
// after the hosting move on 2026-11-23 and cost the ads most of a day of
// tracking. Fail production builds on Vercel instead, so the live site stays on
// the previous deployment. Local and preview builds are unaffected.
if (
  process.env.VERCEL_ENV === "production" &&
  !/^GTM-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GTM_ID ?? "")
) {
  throw new Error(
    "Production build stopped: NEXT_PUBLIC_GTM_ID is missing or invalid. " +
      "Add it in Vercel (Settings > Environment Variables > Production) and redeploy. " +
      "Without it the site has no Tag Manager, cookie banner or Meta pixel.",
  );
}

const nextConfig: NextConfig = {
  // Pin the workspace root so Next.js doesn't infer it from the stray
  // lockfile at C:\Users\August\Desktop\Code\package-lock.json.
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.figma.com",
        pathname: "/api/mcp/asset/**",
      },
      {
        // Any Firebase Storage bucket on this host (prod + dev projects), so
        // review/tour images from imheretravels-a3f81 and imheretravels-dev
        // both render through next/image.
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/**",
      },
      {
        protocol: "https",
        hostname: "imheretravels.com",
        pathname: "/wp-content/uploads/**",
      },
      {
        protocol: "https",
        hostname: "i0.wp.com",
        pathname: "/imheretravels.com/**",
      },
      {
        // Google reviewer avatars (Business Profile API profilePhotoUrl) are
        // served from lh3/lh4/lh5.googleusercontent.com — hotlinked, not re-hosted.
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
  async redirects() {
    return [
      // Keep historical and dynamically constructed asset URLs working after
      // the verified originals have moved out of the deployment into Firebase.
      ...Object.entries(publicAssets as Record<string, { destination: string }>).flatMap(([source, asset]) =>
        // Browsers preserve '&' in a pathname; callers may also encode it.
        [...new Set([encodeURI(source), source.split("/").map(encodeURIComponent).join("/")])].map((encoded) => ({
          source: encoded.replace(/[(){}:*+?]/g, "\\$&"),
          destination: asset.destination,
          permanent: true,
        })),
      ),
      { source: "/dev", destination: "/resident-hosts/dev", permanent: true },
      ...getAllTourSlugs().map((slug) => ({
        source: `/${slug}`,
        destination: `/tours/${slug}`,
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
