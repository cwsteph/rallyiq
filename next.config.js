/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],

    // duckdb.ts and StalenessBanner.tsx read these with
    // fs.readFileSync(path.join(process.cwd(), 'data', ...)). Next's tracer
    // only follows static imports, so a runtime-built path is invisible to it
    // and the files never reach the Netlify function bundle. The symptom is
    // silent: readRatings() returns [] on a missing file, so /rankings served
    // an empty list and every match priced off a default Elo of 1500 while the
    // build stayed green.
    outputFileTracingIncludes: {
      '/**': [
        './data/ratings.json',
        './data/today.json',
        './data/health.json',
        './data/search-index.json',
      ],
    },
  },
}

module.exports = nextConfig
