/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The Atlas reads the committed CMS seed (data/seed/**) at runtime via
  // fs.readFileSync with a dynamic path. Next's file tracer can't infer that
  // path statically, so on Vercel the files would be missing from the
  // serverless functions (ENOENT). Force them to be traced into every route
  // that renders data. The full seed is ~71MB uncompressed — well under
  // Vercel's 250MB per-function limit — so this deploys straight from git,
  // with Supabase available as the durable store for later phases.
  experimental: {
    outputFileTracingIncludes: {
      "/**": ["./data/seed/**/*"],
      "/": ["./data/seed/**/*"],
      "/search": ["./data/seed/**/*"],
      "/facility/[ccn]": ["./data/seed/**/*"],
      "/chain/[id]": ["./data/seed/**/*"],
      "/chains": ["./data/seed/**/*"],
      "/methodology": ["./data/seed/**/*"],
    },
  },
};

export default nextConfig;
