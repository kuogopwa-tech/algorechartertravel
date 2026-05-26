// Vercel Serverless Function: /api/health
export default async function handler(_req, res) {
  return res.status(200).json({
    ok: true,
    service: "Algore Charter Travels AI API",
  });`n}`n
