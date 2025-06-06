/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
      remotePatterns: [
        {
          protocol: "https",
          hostname: "randomuser.me",
          pathname: "/**",
        },
      ],
    },

    experimental:{
      serverActions:{
        bodySizeLimit:"5mb",
      },
    },
};

module.exports = {
  images: {
    domains: ['randomuser.me'],
  },
};


export default nextConfig;
