/** @type {import('next').NextConfig} */
const nextConfig = {
  // ให้ Vercel แพ็กไฟล์ใน data/ ไปกับ serverless function (เราอ่านผ่าน process.cwd())
  outputFileTracingIncludes: { "/**": ["./data/model_params.json"] },
};

export default nextConfig;
