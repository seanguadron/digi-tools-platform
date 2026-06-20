import os from "node:os";
import type { NextConfig } from "next";

// Next.js 16 blocks cross-origin dev resources (including the client runtime) for
// any origin other than localhost. That makes the app load but go unresponsive when
// opened over the network, e.g. http://192.168.x.x:5100. Whitelist this machine's
// current LAN IPv4 addresses so the dev server stays interactive there too. This is
// detected at startup, so it keeps working if the router assigns a different IP.
const localNetworkOrigins = Object.values(os.networkInterfaces())
  .flat()
  .flatMap((iface) =>
    iface && iface.family === "IPv4" && !iface.internal ? [iface.address] : [],
  );

const nextConfig: NextConfig = {
  allowedDevOrigins: localNetworkOrigins,
};

export default nextConfig;
