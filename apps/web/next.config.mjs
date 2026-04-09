/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  async rewrites() {
    return [
      {
        source: "/",
        destination: "/landing-page.html"
      },
      {
        source: "/landing",
        destination: "/landing-page.html"
      },
      {
        source: "/solutions",
        destination: "/solutions.html"
      },
      {
        source: "/solutions/ecommerce",
        destination: "/solutions-ecommerce.html"
      },
      {
        source: "/solutions/restaurant",
        destination: "/solutions-restaurant.html"
      },
      {
        source: "/solutions/salon",
        destination: "/solutions-salon.html"
      },
      {
        source: "/solutions/support",
        destination: "/solutions-support.html"
      }
    ];
  }
};

export default nextConfig;
