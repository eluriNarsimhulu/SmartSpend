const Groq = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

const GROQ_MODEL =
    process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

module.exports = {
    groq,
    GROQ_MODEL,
};