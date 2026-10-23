import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  devIndicators: false,
  // Preserva o contrato AGENTS.md mantido pelo projeto.
  agentRules: false,
};

export default nextConfig;
