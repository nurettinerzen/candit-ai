/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  async redirects() {
    return [
      {
        source: "/landing",
        destination: "/",
        permanent: true
      },
      {
        source: "/landing-page.html",
        destination: "/",
        permanent: true
      },
      {
        source: "/solutions.html",
        destination: "/solutions",
        permanent: true
      },
      {
        source: "/solutions/ecommerce",
        destination: "/solutions/perakende",
        permanent: true
      },
      {
        source: "/solutions-ecommerce.html",
        destination: "/solutions/perakende",
        permanent: true
      },
      {
        source: "/solutions/restaurant",
        destination: "/solutions",
        permanent: true
      },
      {
        source: "/solutions-restaurant.html",
        destination: "/solutions",
        permanent: true
      },
      {
        source: "/solutions/salon",
        destination: "/solutions",
        permanent: true
      },
      {
        source: "/solutions-salon.html",
        destination: "/solutions",
        permanent: true
      },
      {
        source: "/solutions/support",
        destination: "/solutions",
        permanent: true
      },
      {
        source: "/solutions-support.html",
        destination: "/solutions",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
