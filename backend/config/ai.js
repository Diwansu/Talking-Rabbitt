import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

export const ai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || process.env.GROK_API_KEY,
  baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
});

export const aiModel = process.env.GROQ_MODEL || process.env.GROK_MODEL || 'llama-3.3-70b-versatile';
