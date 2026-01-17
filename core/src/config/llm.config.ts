export const LLM = {
  BASE_URL: process.env.LLM_BASE_URL || "http://localhost:8000/v1",
  MODEL: process.env.LLM_MODEL || "default",
  API_KEY: process.env.LLM_API_KEY || "",
};
