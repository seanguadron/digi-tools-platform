import os from "node:os";
import type { NextConfig } from "next";

// Next.js 16 blocks cross-origin dev resources (including the client runtime) for
// any origin other than localhost. That makes the app load but go unresponsive when
// opened over the network, e.g. http://192.168.x.x:5100. Whitelist this machine's
// current LAN IPv4 addresses so the dev server stays interactive there too. This is
// detected at startup, so it keeps working if the router assigns a different IP.
//
// This is NOT a security boundary: it only unblocks /_next assets, and never gates
// application routes. `next dev` binds every interface, so anything on the network
// can reach the app's routes while it runs. The Card Studio's write endpoint
// therefore does its own loopback-Host check (src/app/api/card-art/route.ts).
const localNetworkOrigins = Object.values(os.networkInterfaces())
  .flat()
  .flatMap((iface) =>
    iface && iface.family === "IPv4" && !iface.internal ? [iface.address] : [],
  );

const nextConfig: NextConfig = {
  allowedDevOrigins: localNetworkOrigins,
  // Keep the art trees out of the Card Studio endpoint's serverless bundle.
  // That route's file mechanics (scripts/card-art-store.mjs) build read/write
  // paths under public/card-art and card-art-source, so Next's tracer pulls
  // the whole art tree in with it - 264MB of webp, which put the function at
  // 266MB against Vercel's 250MB ceiling the moment the gallery pack landed
  // and failed the deploy (2026-08-20).
  //
  // Excluding them is correct, not a workaround: the endpoint is
  // development-only and 404s in production before it touches the filesystem
  // (isProduction in src/app/api/card-art/route.ts), and the images the app
  // actually renders ship as ordinary static assets from public/. The
  // function never needs a second copy of them at any time.
  outputFileTracingExcludes: {
    "/api/card-art": ["./public/card-art/**", "./card-art-source/**"],
  },
};

export default nextConfig;
