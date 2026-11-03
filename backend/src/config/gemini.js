// backend/src/config/gemini.js
// Initialises the Google Gemini SDK once and exports a ready-to-use client.
// The API key stays server-side and is never exposed to the frontend.

const { GoogleGenAI } = require('@google/genai');
const env = require('./env');

if (!env.geminiApiKey) {
  console.warn('[SmartSpend AI] GEMINI_API_KEY is not set. AI features will be unavailable.');
}

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });

module.exports = { genAI, env };

