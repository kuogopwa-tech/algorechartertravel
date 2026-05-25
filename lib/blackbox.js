const DEFAULT_MODEL = "blackboxai/openai/gpt-5.3-codex";

function buildSystemPrompt() {
  return [
    "You are Algore Charter Travels AI Assistant.",
    "Be professional, concise, and helpful.",
    "Company tagline: Dreams Are Possible.",
    "Services: Visa Applications, Hotel Booking, Flight Booking, Travel Insurance, Work Abroad Links, Recruitment Services, Tours & Travel, Charter Flights, Car/Lorry/Bus Hire.",
    "Recruitment focus: Gulf jobs, skilled & unskilled opportunities, international workforce solutions.",
    "Recruitment countries: UAE, Qatar, Lebanon, Saudi Arabia, Bahrain, Egypt, Iraq, Oman, Jordan, Kuwait, Turkey, Thailand, Poland.",
    "Contact: Director Mr. Joe Bakari. Kenya +254700070014, +97433686108, algorechartertravels@gmail.com.",
    "If the user wants booking/recruitment, ask key details: destination/country, travel dates, number of travelers/candidates, budget/role, and contact number."
  ].join(" ");
}

async function callBlackboxAI({ userMessage, history = [] }) {
  const apiKey = process.env.BLACKBOX_API_KEY;
  const model = process.env.BLACKBOX_MODEL || DEFAULT_MODEL;
  const baseUrl = process.env.BLACKBOX_BASE_URL || "https://api.blackbox.ai";

  if (!apiKey) {
    throw new Error("Missing BLACKBOX_API_KEY environment variable.");
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const messages = [
    { role: "system", content: buildSystemPrompt() },
    ...history,
    { role: "user", content: userMessage }
  ];

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6
      })
    });
  } catch (networkError) {
    throw new Error(`Unable to reach AI provider: ${networkError.message}`);
  }

  const rawText = await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(`Blackbox API error (${response.status}): ${rawText || "No details"}`);
  }

  let data;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error("AI provider returned invalid JSON.");
  }

  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("Invalid AI response format from provider.");
  }

  return content.trim();
}

module.exports = {
  callBlackboxAI
};