// Vercel Serverless Function: /api/test
module.exports = async (_req, res) => {
  return res.status(200).json({ status: "working" });
};