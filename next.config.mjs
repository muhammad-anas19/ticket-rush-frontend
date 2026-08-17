/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  sassOptions: {
    // Makes design tokens available in every .module.scss without an @use line in each file.
    // Note this is a *compile-time* injection of SCSS variables — it produces no CSS output
    // by itself, which is exactly why abstracts/ contains only variables, mixins and
    // functions. Injecting a file that emitted rules would duplicate them into every module.
    additionalData: `@use "@/shared/styles/abstracts" as *;\n`,
  },
};

export default nextConfig;
