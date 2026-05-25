// Vercel Serverless Function: /api/health
module.exports = async (_req, res) => {
  return res.status(200).json({
    ok: true,
    service: "Algore Charter Travels AI API",
  });
};