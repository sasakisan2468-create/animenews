import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const VALID_CATEGORIES = [
  'Anime', 'Manga', 'News', 'Interview', 'Merchandise', 'Event', 'Game',
  'Movie', 'Trailer', 'PV', 'Blu-ray', 'Figure', 'Convention', 'Studio',
  'Seiyuu', 'Music'
];

function buildPrompt(item) {
  return `You are a professional anime news editor and Burmese (Myanmar) translator.

Given the following anime news item, respond with ONLY a valid JSON object (no markdown, no code fences, no extra text) with these exact keys:
{
  "title_my": "Burmese translation of the title, natural and fluent",
  "summary_my": "Burmese translation of the summary, 1-3 sentences",
  "content_my": "Burmese translation of the full content, fluent and natural",
  "category": ["array of 1-3 categories from this exact list only: ${VALID_CATEGORIES.join(', ')}"],
  "is_breaking": true or false (true only if this is major, urgent, time-sensitive news),
  "is_trending": true or false (true if this is likely to be very popular/high engagement)
}

News item:
Title: ${item.original_title}
Summary: ${item.summary || ''}
Content: ${(item.content || '').slice(0, 1000)}
Source: ${item.source_name}

Respond with ONLY the JSON object.`;
}

function safeParseJSON(text) {
  if (!text) return null;
  // Strip markdown code fences if the model added them anyway
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract the first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeResult(parsed, item) {
  const categories = Array.isArray(parsed.category)
    ? parsed.category.filter((c) => VALID_CATEGORIES.includes(c))
    : [];

  return {
    title_my: parsed.title_my || item.original_title,
    summary_my: parsed.summary_my || item.summary || '',
    content_my: parsed.content_my || item.content || '',
    category: categories.length > 0 ? categories : ['News'],
    is_breaking: Boolean(parsed.is_breaking),
    is_trending: Boolean(parsed.is_trending)
  };
}

async function translateWithGemini(item) {
  if (!genAI) throw new Error('Gemini API key not configured');

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(buildPrompt(item));
  const text = result.response.text();
  const parsed = safeParseJSON(text);

  if (!parsed) throw new Error('Gemini returned unparseable JSON');
  return normalizeResult(parsed, item);
}

async function translateWithGroq(item) {
  if (!groq) throw new Error('Groq API key not configured');

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: buildPrompt(item) }],
    temperature: 0.3,
    max_tokens: 1500
  });

  const text = completion.choices[0]?.message?.content || '';
  const parsed = safeParseJSON(text);

  if (!parsed) throw new Error('Groq returned unparseable JSON');
  return normalizeResult(parsed, item);
}

/**
 * Translate + categorize a news item into Burmese.
 * Tries Gemini first, falls back to Groq (Llama 3) on failure.
 * If both fail, falls back to raw untranslated content so the
 * pipeline never crashes on an AI outage.
 */
export async function translateAndCategorize(item) {
  try {
    return await translateWithGemini(item);
  } catch (geminiError) {
    console.warn(`⚠️ Gemini failed for "${item.original_title}": ${geminiError.message}. Falling back to Groq...`);
    try {
      return await translateWithGroq(item);
    } catch (groqError) {
      console.error(`❌ Groq also failed for "${item.original_title}": ${groqError.message}. Using raw fallback.`);
      return {
        title_my: item.original_title,
        summary_my: item.summary || '',
        content_my: item.content || '',
        category: ['News'],
        is_breaking: false,
        is_trending: false
      };
    }
  }
}
