import express from "express";
import cors from "cors";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import fetch from "node-fetch";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
import multer from "multer";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { google } from "googleapis";

dotenv.config();

// Import CommonJS module (pdf-parse) using createRequire
const require = createRequire(import.meta.url);
const pdfParseModule = require("pdf-parse");

function createPdfParseAdapter(module) {
  if (typeof module === "function") {
    return module;
  }

  const PdfParseClass =
    module?.PDFParse ||
    module?.default ||
    module?.pdfParse ||
    module?.PdfParse;

  if (typeof PdfParseClass === "function") {
    return async function pdfParseAdapter(data, options = {}) {
      const { text: textOptions, ...parserOptions } = options || {};
      const parser = new PdfParseClass({ ...parserOptions, data });
      try {
        const textResult = await parser.getText(textOptions || {});
        return {
          text: textResult?.text || "",
          metadata: textResult?.metadata || null,
          version: textResult?.version || null,
        };
      } finally {
        if (typeof parser.destroy === "function") {
          await parser.destroy();
        }
      }
    };
  }

  throw new Error("Unsupported pdf-parse module export format.");
}

const pdfParse = createPdfParseAdapter(pdfParseModule);

const app = express();          // <-- ONLY ONCE!

// CORS must be first - allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

// Body parser - ONLY for JSON, NOT for multipart/form-data
// Multer will handle multipart/form-data, so we skip it here
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  
  // Skip body parsing for multipart/form-data - multer handles it
  if (contentType.includes('multipart/form-data')) {
    return next();
  }
  
  // Parse JSON for other requests
  if (contentType.includes('application/json')) {
    express.json({ limit: "50mb" })(req, res, next);
  } else {
    // Parse urlencoded for form-urlencoded
    express.urlencoded({ extended: true, limit: "50mb" })(req, res, next);
  }
});

// Ensure absolute template path (works regardless of current working dir)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure upload directories
const UPLOADS_DIR = path.join(__dirname, "uploads");

// Ensure directories exist (sync version for multer)
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log("✅ Created uploads directory:", UPLOADS_DIR);
}

// Configure multer for file uploads (memory storage first, then save to disk)
// This is more reliable than diskStorage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const TEMPLATE_PATH = path.join(__dirname, "templates", "resume-template.html");
const BASE_RESUME_PATH = path.join(__dirname, "Data", "base_resume.json");

// Load base resume data (fixed fields)
let BASE_RESUME_DATA = null;
async function loadBaseResume() {
  try {
    console.log("📂 Looking for base_resume.json at:", BASE_RESUME_PATH);
    const data = await fs.readFile(BASE_RESUME_PATH, "utf8");
    BASE_RESUME_DATA = JSON.parse(data);
    console.log("✅ Loaded base resume data");
  } catch (err) {
    console.error("⚠️ Could not load base_resume.json, using defaults");
    console.error("   Path attempted:", BASE_RESUME_PATH);
    console.error("   Error:", err.message);
    BASE_RESUME_DATA = {
      name: "Your Name",
      email: "your.email@example.com",
      phone: "123-456-7890",
      linkedin: "https://linkedin.com/in/yourprofile",
      portfolio: "https://yourportfolio.com",
      education: "Your Education Details",
      certs: "Your Certifications and Patents"
    };
  }
}
loadBaseResume();

// Store uploaded resume data (in-memory, can be enhanced with session storage)
let UPLOADED_RESUME_DATA = null;
let UPLOADED_RESUME_TEXT = null; // Raw text extracted from uploaded resume
let UPLOADED_PDF_PATH = null; // Store path to uploaded PDF for reference

// env
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-3.5-turbo";
const MODEL_PROVIDER = (process.env.MODEL_PROVIDER || "openai").toLowerCase(); // 'openai', 'ollama', 'gemini', 'anthropic', 'deepseek', 'xai'
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const XAI_API_KEY = process.env.XAI_API_KEY || "";

const VALID_LLM_PROVIDERS = new Set(["openai", "ollama", "gemini", "anthropic", "deepseek", "xai"]);
const OLLAMA_MODEL_ALIASES = {
  llama3: "llama3",
  "llama3.1": "llama3.1",
  deepseek: "deepseek-r1:latest",
  "deepseek-r1": "deepseek-r1:latest",
  "deepseek-r1:latest": "deepseek-r1:latest"
};
const PORT = process.env.PORT || 4000;

if (!VALID_LLM_PROVIDERS.has(MODEL_PROVIDER)) {
  console.warn(`⚠️ MODEL_PROVIDER "${MODEL_PROVIDER}" is not supported. Falling back to OpenAI.`);
}

if (MODEL_PROVIDER === "openai" && !OPENAI_API_KEY) {
  console.warn("⚠️ OPENAI_API_KEY is not set — set in .env if you want to use the OpenAI provider.");
}

if (MODEL_PROVIDER === "gemini") {
  if (!GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY is not set — set in .env if you want to use the Gemini provider.");
  } else {
    console.log(`Using Gemini model ${GEMINI_MODEL}`);
  }
}

if (MODEL_PROVIDER === "ollama") {
  console.log(`Using Ollama at ${OLLAMA_URL}. Default model: ${OLLAMA_MODEL}`);
}

if (MODEL_PROVIDER === "anthropic" && !ANTHROPIC_API_KEY) {
  console.warn("⚠️ ANTHROPIC_API_KEY is not set — set in .env if you want to use the Anthropic provider.");
}

if (MODEL_PROVIDER === "deepseek" && !DEEPSEEK_API_KEY) {
  console.warn("⚠️ DEEPSEEK_API_KEY is not set — set in .env if you want to use the DeepSeek provider.");
}

if (MODEL_PROVIDER === "xai" && !XAI_API_KEY) {
  console.warn("⚠️ XAI_API_KEY is not set — set in .env if you want to use the xAI provider.");
}

// -------------------- helpers --------------------
function resolveProvider(providerOverride) {
  const normalized = (providerOverride || MODEL_PROVIDER || "openai").toLowerCase();
  if (!VALID_LLM_PROVIDERS.has(normalized)) {
    console.warn(`⚠️ Unknown LLM provider "${providerOverride}". Defaulting to OpenAI.`);
    return "openai";
  }
  return normalized;
}

function resolveOllamaModel(modelOverride) {
  if (!modelOverride) return OLLAMA_MODEL;
  const aliasKey = modelOverride.toLowerCase();
  return OLLAMA_MODEL_ALIASES[aliasKey] || modelOverride;
}

function safeInjectTemplate(templateStr, replacements) {
  let out = templateStr;
  
  // Process all replacements
  for (const key of Object.keys(replacements)) {
    const keyUpper = key.toUpperCase();
    const placeholder = `{{${keyUpper}}}`;
    let value = String(replacements[key] ?? "").trim();
    
    // Special handling for LINKEDIN and PORTFOLIO - these are URLs for href attributes
    if (keyUpper === 'LINKEDIN' || keyUpper === 'PORTFOLIO') {
      // Clean the URL: remove any HTML tags, unescape entities, remove quotes
      value = value
        .replace(/<[^>]*>/g, '')           // Remove HTML tags
        .replace(/&amp;/g, '&')              // Unescape ampersand
        .replace(/&lt;/g, '<')               // Unescape less than
        .replace(/&gt;/g, '>')               // Unescape greater than
        .replace(/&quot;/g, '"')             // Unescape quotes
        .replace(/&nbsp;/g, ' ')             // Unescape non-breaking space
        .replace(/["']/g, '')                // Remove any remaining quotes
        .trim();
      
      // Replace placeholder with clean URL (simple string replacement)
      out = out.split(placeholder).join(value);
    } else {
      // For other fields, use the value as-is (already processed by textToHtmlPreserveLinebreaks)
      out = out.split(placeholder).join(value);
    }
  }
  
  return out;
}

function textToHtmlPreserveLinebreaks(txt) {
  // Convert newline characters to proper HTML formatting with bullets
  // We do this conversion consistently for injected raw text.
  if (!txt && txt !== "") return "";
  // Trim only trailing/leading newlines? Keep user's newlines.
  let text = txt.replace(/\r\n/g, "\n");
  
  // Convert lines starting with "-" or "•" to bullet points
  // Handle section titles (Patents, Publications) specially
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  
  for (let line of lines) {
    const trimmed = line.trim();
    const isBullet = trimmed.startsWith('-') || trimmed.startsWith('•');
    const isSectionTitle = !isBullet && trimmed && 
                           (trimmed.toLowerCase().includes('patent') || 
                            trimmed.toLowerCase().includes('publication'));
    
    if (isBullet) {
      if (!inList) {
        html += '<ul style="list-style: none; padding-left: 0; margin: 0;">';
        inList = true;
      }
      // Always use "•" bullet, remove any "-" or "•" prefix
      const content = trimmed.replace(/^[-•]\s*/, '').trim();
      // Escape HTML entities in content
      const escapedContent = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      // Use actual bullet character (U+2022) in HTML - ensure it's visible
      html += `<li style="margin-bottom: 6px; padding-left: 18px; position: relative;"><span style="position: absolute; left: 0; color: #3498db; font-weight: bold; font-size: 14pt;">&#8226;</span><span style="padding-left: 4px;">${escapedContent}</span></li>`;
    } else if (trimmed === '') {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += '<br>';
    } else if (isSectionTitle) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<div class="section-title" style="margin-top: 16px;">${trimmed.toUpperCase()}</div>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      // Regular text (like education) - no bullets, just display
      const escapedText = trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html += `<div style="margin-bottom: 4px;">${escapedText}</div>`;
    }
  }
  
  if (inList) {
    html += '</ul>';
  }
  
  return html || text.replace(/\n/g, "<br>");
}


// Reuse safe JSON parsing helpers (from prior)
function safeParseJSON(text) {
  if (!text || typeof text !== "string") throw new Error("safeParseJSON: input empty");
  try { return JSON.parse(text); } catch (e) {}
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch (e) {}
  }
  throw new Error("safeParseJSON: could not parse JSON (see logs)");
}

async function debugFetchResponse(res) {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  return { ok: res.ok, status: res.status, statusText: res.statusText, contentType: ct, bodyPreview: text.slice(0, 2000) };
}

// -------------------- LLM helpers --------------------
async function callOpenAI_chat_returnString(prompt, options = {}) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const url = "https://api.openai.com/v1/chat/completions";
  const model = options.model || OPENAI_MODEL;
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.maxTokens ?? 1200;

  const messages = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens
  };

  if (options.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const dbg = await debugFetchResponse(res);
    console.error("OpenAI non-OK:", dbg);
    throw new Error(`OpenAI error ${dbg.status} ${dbg.statusText}. Preview:\n${dbg.bodyPreview}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    console.error("OpenAI unexpected payload:", JSON.stringify(data).slice(0, 2000));
    throw new Error("OpenAI returned unexpected payload.");
  }
  return content;
}

async function callOllama_generate_returnString(prompt, options = {}) {
  const url = `${OLLAMA_URL.replace(/\/$/, "")}/api/generate`;
  const model = resolveOllamaModel(options.model);
  let combinedPrompt = prompt;
  if (options.systemPrompt) {
    combinedPrompt = `${options.systemPrompt.trim()}\n\n${prompt}`;
  }

  const body = {
    model,
    prompt: combinedPrompt,
    stream: false
  };

  if (options.temperature !== undefined || options.maxTokens !== undefined) {
    body.options = {};
    if (options.temperature !== undefined) body.options.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.options.num_predict = options.maxTokens;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const dbg = await debugFetchResponse(res);
    console.error("Ollama non-OK:", dbg);
    throw new Error(`Ollama error ${dbg.status} ${dbg.statusText}. Preview:\n${dbg.bodyPreview}`);
  }

  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.response === "string") {
      return parsed.response;
    }
  } catch (err) {
    // Ignore parse errors; fall back to raw string
  }
  return raw;
}

async function callGemini_generate_returnString(prompt, options = {}) {
  const apiKey = options.apiKey || GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Provide GEMINI_API_KEY in .env.");
  }

  const model = options.model || GEMINI_MODEL;
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.maxTokens ?? 2048;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const userTextParts = [];
  if (options.systemPrompt) {
    userTextParts.push(options.systemPrompt.trim());
  }
  userTextParts.push(prompt);

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: userTextParts.join("\n\n") }]
      }
    ],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const dbg = await debugFetchResponse(res);
    console.error("Gemini non-OK:", dbg);
    throw new Error(`Gemini error ${dbg.status} ${dbg.statusText}. Preview:\n${dbg.bodyPreview}`);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!text) {
    console.error("Gemini unexpected payload:", JSON.stringify(data).slice(0, 2000));
    throw new Error("Gemini returned unexpected payload.");
  }
  return text;
}

async function callAnthropic_generate_returnString(prompt, options = {}) {
  const apiKey = options.apiKey || ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Anthropic API key is not configured. Provide ANTHROPIC_API_KEY in .env.");
  }

  const model = options.model || "claude-sonnet-4-20250514";
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.maxTokens ?? 4096;
  const url = "https://api.anthropic.com/v1/messages";

  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    temperature
  };

  if (options.systemPrompt) {
    body.system = options.systemPrompt.trim();
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const dbg = await debugFetchResponse(res);
    console.error("Anthropic non-OK:", dbg);
    throw new Error(`Anthropic error ${dbg.status} ${dbg.statusText}. Preview:\n${dbg.bodyPreview}`);
  }

  const data = await res.json();
  const content = data?.content?.[0]?.text;
  if (typeof content !== "string") {
    console.error("Anthropic unexpected payload:", JSON.stringify(data).slice(0, 2000));
    throw new Error("Anthropic returned unexpected payload.");
  }
  return content;
}

async function callDeepSeek_generate_returnString(prompt, options = {}) {
  const apiKey = options.apiKey || DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DeepSeek API key is not configured. Provide DEEPSEEK_API_KEY in .env.");
  }

  const model = options.model || "deepseek-chat";
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.maxTokens ?? 4096;
  const url = "https://api.deepseek.com/v1/chat/completions";

  const messages = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens
  };

  if (options.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const dbg = await debugFetchResponse(res);
    console.error("DeepSeek non-OK:", dbg);
    throw new Error(`DeepSeek error ${dbg.status} ${dbg.statusText}. Preview:\n${dbg.bodyPreview}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    console.error("DeepSeek unexpected payload:", JSON.stringify(data).slice(0, 2000));
    throw new Error("DeepSeek returned unexpected payload.");
  }
  return content;
}

async function callXAI_generate_returnString(prompt, options = {}) {
  const apiKey = options.apiKey || XAI_API_KEY;
  if (!apiKey) {
    throw new Error("xAI API key is not configured. Provide XAI_API_KEY in .env.");
  }

  const model = options.model || "grok-beta";
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.maxTokens ?? 4096;
  const url = "https://api.x.ai/v1/chat/completions";

  const messages = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens
  };

  if (options.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const dbg = await debugFetchResponse(res);
    console.error("xAI non-OK:", dbg);
    throw new Error(`xAI error ${dbg.status} ${dbg.statusText}. Preview:\n${dbg.bodyPreview}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    console.error("xAI unexpected payload:", JSON.stringify(data).slice(0, 2000));
    throw new Error("xAI returned unexpected payload.");
  }
  return content;
}

async function callLlmReturnString(providerOverride, prompt, options = {}) {
  const provider = resolveProvider(providerOverride);
  switch (provider) {
    case "openai":
      return callOpenAI_chat_returnString(prompt, options);
    case "ollama":
      return callOllama_generate_returnString(prompt, options);
    case "gemini":
      return callGemini_generate_returnString(prompt, options);
    case "anthropic":
      return callAnthropic_generate_returnString(prompt, options);
    case "deepseek":
      return callDeepSeek_generate_returnString(prompt, options);
    case "xai":
      return callXAI_generate_returnString(prompt, options);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

// Call whichever model you want but IMPORTANT: we do not let it alter template layout
// Only generates variable fields: summary, competencies, experience content, projects
async function callModelForFields(description, options = {}) {
  const currentData = getCurrentResumeData();
  const resumeRawText = (UPLOADED_RESUME_TEXT || "").trim();
  const provider = resolveProvider(options.provider);
  
  // Extract experience titles from current resume data (fixed, won't change unless none provided)
  const experienceTitles = currentData?.experience 
    ? currentData.experience.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed.startsWith('•') || trimmed.startsWith('-');
      }).map(line => {
        const trimmed = line.trim();
        // Convert "-" to "•" if needed
        return trimmed.startsWith('-') ? '•' + trimmed.substring(1) : trimmed;
      })
    : [];
  
  const structuredSummary = [
    currentData?.summary ? `Existing summary:\n${currentData.summary}` : null,
    `Education:\n${currentData?.education || "N/A"}`,
    `Experience entries:\n${currentData?.experience || "N/A"}`,
    `Competencies:\n${currentData?.competencies || "N/A"}`,
    `Projects:\n${currentData?.projects || "N/A"}`,
    `Certifications / Patents / Publications:\n${currentData?.certs || "N/A"}`
  ].filter(Boolean).join('\n\n');

  const truncatedRaw = resumeRawText ? resumeRawText.slice(0, 6000) : "";
  const experienceTitlesPrompt = experienceTitles.length > 0
    ? experienceTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')
    : "None supplied. Derive concise headings that reflect the candidate's real roles.";
  
  const prompt = `Use the candidate's resume information and the job description to tailor the variable sections of a resume.

Job Description:
${description}

Resume (structured data):
${structuredSummary}

Resume (raw text excerpt):
${truncatedRaw || "N/A"}

Experience titles/headlines (do not change wording if provided):
${experienceTitlesPrompt}

Requirements:
- Keep education wording exactly as it appears in the resume. You may reference education in other sections but do not rephrase the education block.
- If experience titles are provided, keep them exactly as written and only generate supporting bullet content beneath them. If no titles are provided, create appropriate headings based on the resume.
- Incorporate important achievements, certifications, patents, and other highlights from the resume when drafting the new content. Do not invent details that are not supported by the resume.
- Where a section was empty or thin in the resume, generate strong content that still aligns with the candidate's background and the job description.
- Use the bullet character • for bullet lists and \\n for line breaks.

Generate ONLY the following fields (plain text strings):
1. summary — professional summary tailored to the job, referencing notable resume highlights.
2. competencies — skills/competencies aligned to the job, prioritizing items already present in the resume before adding related items.
3. experience — bullet content that aligns with the fixed experience titles (or the derived ones if none were provided).
4. projects — relevant projects or initiatives tied to the job description; draw from resume details where possible.

Return JSON with keys: summary, competencies, experience, projects. Each value must be a string (use \\n to separate bullets or lines).`;
  
  const systemPrompt = "You are a resume assistant. Return ONLY valid JSON (no markdown) with keys: summary, competencies, experience, projects. Each value must be a single string; use \\n for newline. Do not output any other text.";
  const raw = await callLlmReturnString(provider, prompt, {
    model: options.model,
    systemPrompt,
    temperature: 0.2,
    maxTokens: 1500,
    responseFormat: "json_object",
    apiKey: options.apiKey
  });
  return safeParseJSON(String(raw));
}

// Helper function to get current resume data (uploaded or base)
function getCurrentResumeData() {
  return UPLOADED_RESUME_DATA || BASE_RESUME_DATA;
}

// Function to extract structured data from PDF text using AI
async function extractResumeDataFromText(pdfText, options = {}) {
  const provider = resolveProvider(options.provider);
  const prompt = `Extract the following information from this resume text and return it as JSON. Only extract information that is clearly present in the resume.

Resume Text:
${pdfText}

Extract and return a JSON object with these exact keys:
{
  "name": "Full name from the resume",
  "email": "Email address",
  "phone": "Phone number",
  "linkedin": "LinkedIn URL (full URL if present, empty string if not)",
  "portfolio": "Portfolio/website URL (full URL if present, empty string if not)",
  "education": "All education details with degrees, institutions, and dates. Format: Degree – Major - Institution | Year\\n\\nNext Degree...",
  "experience": "Experience job titles and companies. Format each as: • Job Title | Company Name | Date Range\\n• Next Job Title | Company | Date Range",
  "competencies": "Skills and competencies as a comma-separated list",
  "projects": "Projects listed as: • Project Name: Description\\n• Next Project...",
  "certs": "Certifications, Patents, and Publications. Format as: Patents\\n\\n• Patent Title – Description.\\n\\nPublications\\n\\n• \"Publication Title\" – Conference/Journal, Year."
}

IMPORTANT:
- If a field is not found, use an empty string ""
- For education, use \\n\\n to separate different degrees
- For experience, always start with • (bullet)
- For projects, always start with • (bullet)
- For certs, include both Patents and Publications sections even if empty
- Keep the exact format shown above
- Return ONLY valid JSON, no markdown, no explanations`;

  const systemPrompt = "You are a resume parser. Extract structured information from resume text and return ONLY valid JSON (no markdown, no explanations).";
  const raw = await callLlmReturnString(provider, prompt, {
    model: options.model,
    systemPrompt,
    temperature: 0.1,
    maxTokens: 2200,
    responseFormat: "json_object"
  });
  return safeParseJSON(String(raw));
}

// -------------------- Endpoints --------------------

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Server is running",
    timestamp: new Date().toISOString(),
    endpoints: {
      upload: "POST /api/upload-resume",
      fixedFields: "GET /api/fixed-fields",
      generate: "POST /api/generate",
      inject: "POST /api/inject"
    }
  });
});

// Test endpoint to verify upload route is registered
app.get("/api/test-upload-route", (req, res) => {
  res.json({ 
    message: "Upload route is registered",
    endpoint: "POST /api/upload-resume",
    multer: "configured",
    timestamp: new Date().toISOString()
  });
});

// Function to download file from Google Drive
async function downloadFromGoogleDrive(fileId, drive) {
  try {
    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    
    const chunks = [];
    for await (const chunk of response.data) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  } catch (err) {
    console.error("Error downloading from Google Drive:", err);
    throw err;
  }
}

// Function to list files in Google Drive folder
async function listDriveFolder(folderId, drive) {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/pdf'`,
      fields: 'files(id, name, mimeType)',
    });
    
    return response.data.files || [];
  } catch (err) {
    console.error("Error listing Google Drive folder:", err);
    throw err;
  }
}

// Upload from Google Drive endpoint
app.post("/api/upload-from-drive", async (req, res) => {
  try {
    const { fileId, folderId, fileName } = req.body;
    
    // Use folder ID from request or environment variable or default
    const GOOGLE_DRIVE_FOLDER_ID = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID || "13tYF6fFWRuh22zOE_aziHn908OgSM1O4";
    const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!fileId && !GOOGLE_DRIVE_FOLDER_ID) {
      return res.status(400).json({ 
        error: "Either fileId or folderId is required",
        hint: "Provide fileId in request body, or set GOOGLE_DRIVE_FOLDER_ID in .env"
      });
    }

    // Initialize Google Drive API
    let drive;
    
    if (GOOGLE_SERVICE_ACCOUNT_KEY) {
      // Use service account (recommended for server-side)
      try {
        const key = typeof GOOGLE_SERVICE_ACCOUNT_KEY === 'string' 
          ? JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY) 
          : GOOGLE_SERVICE_ACCOUNT_KEY;
        const auth = new google.auth.GoogleAuth({
          credentials: key,
          scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        drive = google.drive({ version: 'v3', auth });
      } catch (authErr) {
        console.error("Error setting up Google Drive auth:", authErr);
        return res.status(500).json({ 
          error: "Failed to authenticate with Google Drive",
          hint: "Check GOOGLE_SERVICE_ACCOUNT_KEY format in .env"
        });
      }
    } else {
      return res.status(400).json({ 
        error: "Google Drive authentication required",
        hint: "Set GOOGLE_SERVICE_ACCOUNT_KEY in .env file",
        setup: "1. Go to Google Cloud Console\n2. Create a service account\n3. Enable Drive API\n4. Download service account key\n5. Add to .env as GOOGLE_SERVICE_ACCOUNT_KEY (JSON string)"
      });
    }

    let fileBuffer;
    let actualFileName = fileName || "resume.pdf";

    if (fileId) {
      // Download specific file
      console.log("📥 Downloading file from Google Drive:", fileId);
      fileBuffer = await downloadFromGoogleDrive(fileId, drive);
    } else {
      // List files in folder and use the first PDF
      console.log("📁 Listing files in Google Drive folder:", GOOGLE_DRIVE_FOLDER_ID);
      const files = await listDriveFolder(GOOGLE_DRIVE_FOLDER_ID, drive);
      
      if (files.length === 0) {
        return res.status(404).json({ 
          error: "No PDF files found in the specified folder",
          folderId: GOOGLE_DRIVE_FOLDER_ID,
          hint: "Make sure the folder contains PDF files and the service account has access"
        });
      }
      
      // Use the first PDF file
      const firstFile = files[0];
      console.log("📥 Downloading file:", firstFile.name, "(" + firstFile.id + ")");
      fileBuffer = await downloadFromGoogleDrive(firstFile.id, drive);
      actualFileName = firstFile.name;
    }

    // Save file to disk
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const pdfPath = path.join(UPLOADS_DIR, `resume-${uniqueSuffix}.pdf`);
    await fs.writeFile(pdfPath, fileBuffer);
    UPLOADED_PDF_PATH = pdfPath;
    
    console.log("💾 PDF saved to:", pdfPath);

    // Extract text from PDF
    console.log("📄 Extracting text from PDF...");
    const pdfData = await pdfParse(fileBuffer);
    let pdfText = pdfData.text;

    if (!pdfText || pdfText.trim().length === 0) {
      try {
        await fs.unlink(pdfPath);
        UPLOADED_PDF_PATH = null;
      } catch (e) {}
      return res.status(400).json({ error: "Could not extract text from PDF. Please ensure the PDF contains text." });
    }

    console.log("   Extracted text length:", pdfText.length, "characters");

    // Store raw text for downstream generation/personalization
    UPLOADED_RESUME_TEXT = pdfText;

    // Extract resume data
    console.log("🤖 Extracting resume data...");
    const extractedData = await extractResumeDataFromText(pdfText);
    UPLOADED_RESUME_DATA = extractedData;

    console.log("✅ Resume data extracted and stored:");
    console.log("   Name:", extractedData.name || "NOT FOUND");
    console.log("   Email:", extractedData.email || "NOT FOUND");

    const experienceTitles = (extractedData.experience || "").split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('•') || trimmed.startsWith('-');
    }).map(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('-') ? '•' + trimmed.substring(1) : trimmed;
    });

    return res.json({
      success: true,
      message: `Resume downloaded from Google Drive and processed successfully!`,
      data: {
        name: extractedData.name || "",
        email: extractedData.email || "",
        phone: extractedData.phone || "",
        linkedin: extractedData.linkedin || "",
        portfolio: extractedData.portfolio || "",
        education: extractedData.education || "",
        certs: extractedData.certs || "",
        experienceTitles: experienceTitles
      },
      extractedFields: Object.keys(extractedData),
      pdfPath: pdfPath,
      fileName: actualFileName,
      source: "Google Drive"
    });
  } catch (err) {
    console.error("❌ Google Drive upload error:", err);
    return res.status(500).json({ 
      error: err.message || "Failed to process file from Google Drive",
      details: process.env.NODE_ENV === "development" ? err.stack : undefined,
      hint: "Make sure Google Drive API is enabled and service account has access to the folder"
    });
  }
});

// List all registered routes (for debugging)
app.get("/api/routes", (req, res) => {
  const routes = [];
  try {
    // Try Express 4/5 router structure
    if (app._router && app._router.stack) {
      app._router.stack.forEach((middleware) => {
        if (middleware.route) {
          const methods = Object.keys(middleware.route.methods);
          routes.push({
            method: methods[0].toUpperCase(),
            path: middleware.route.path
          });
        }
      });
    }
  } catch (err) {
    console.warn("Could not list routes:", err.message);
  }
  res.json({ 
    routes, 
    total: routes.length,
    note: routes.length === 0 ? "Route listing may not be available in Express 5. Routes are still registered." : null
  });
});

// Upload PDF resume endpoint - WITH EXPLICIT ERROR HANDLING
const uploadHandler = upload.single("resume");

app.post("/api/upload-resume", (req, res, next) => {
  console.log("📤 ===== UPLOAD REQUEST RECEIVED =====");
  console.log("   URL:", req.url);
  console.log("   Method:", req.method);
  console.log("   Path:", req.path);
  console.log("   Content-Type:", req.headers["content-type"]);
  
  // Apply multer middleware
  uploadHandler(req, res, (err) => {
    if (err) {
      console.error("❌ Multer error:", err);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    // Continue to route handler
    next();
  });
}, async (req, res) => {
  // Check if file was uploaded
  if (!req.file) {
    console.error("❌ No file in request");
    console.error("   Request body keys:", Object.keys(req.body || {}));
    return res.status(400).json({ 
      error: "No file uploaded. Please select a PDF file.",
      hint: "Make sure the form field name is 'resume' and Content-Type is multipart/form-data"
    });
  }
  
  try {
    console.log("📄 Processing uploaded file...");
    console.log("   File name:", req.file.originalname);
    console.log("   File size:", req.file.size, "bytes");

    // Validate file type
    if (req.file.mimetype !== "application/pdf") {
      console.error("❌ Invalid file type:", req.file.mimetype);
      return res.status(400).json({ error: "Only PDF files are supported" });
    }

    // Save file to disk for later reference
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const pdfPath = path.join(UPLOADS_DIR, `resume-${uniqueSuffix}.pdf`);
    await fs.writeFile(pdfPath, req.file.buffer);
    UPLOADED_PDF_PATH = pdfPath;
    
    console.log("💾 PDF saved to:", pdfPath);

    // Step 1: Extract text from PDF (use buffer directly)
    console.log("📄 Step 1: Extracting text from PDF...");
    const pdfData = await pdfParse(req.file.buffer);
    let pdfText = pdfData.text;

    if (!pdfText || pdfText.trim().length === 0) {
      // Clean up uploaded file
      try {
        await fs.unlink(pdfPath);
        UPLOADED_PDF_PATH = null;
      } catch (e) {}
      return res.status(400).json({ error: "Could not extract text from PDF. Please ensure the PDF contains text." });
    }

    console.log("   Extracted text length:", pdfText.length, "characters");

    // Store raw text for downstream generation/personalization
    UPLOADED_RESUME_TEXT = pdfText;

    // Step 2: Extract resume data
    console.log("🤖 Step 2: Extracting resume data...");
    const extractedData = await extractResumeDataFromText(pdfText);

    // Store the extracted data
    UPLOADED_RESUME_DATA = extractedData;

    console.log("✅ Resume data extracted and stored:");
    console.log("   Name:", extractedData.name || "NOT FOUND");
    console.log("   Email:", extractedData.email || "NOT FOUND");
    console.log("   Phone:", extractedData.phone || "NOT FOUND");
    console.log("   Education:", extractedData.education ? extractedData.education.substring(0, 50) + "..." : "NOT FOUND");
    console.log("   Experience titles:", extractedData.experience ? extractedData.experience.split('\n').length : 0, "items");
    
    // Verify extracted data
    if (!extractedData.name || !extractedData.email) {
      console.warn("⚠️ Warning: Critical fields (name, email) may be missing from extracted data");
    }

    // Return the extracted data with debug info
    const responseData = {
      success: true,
      message: "Resume uploaded and parsed successfully. Your uploaded resume data will now be used for fixed fields (name, email, education, etc.).",
      data: {
        name: extractedData.name || "",
        email: extractedData.email || "",
        phone: extractedData.phone || "",
        linkedin: extractedData.linkedin || "",
        portfolio: extractedData.portfolio || "",
        education: extractedData.education || "",
        certs: extractedData.certs || "",
        experienceTitles: (extractedData.experience || "").split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed.startsWith('•') || trimmed.startsWith('-');
        }).map(line => {
          const trimmed = line.trim();
          return trimmed.startsWith('-') ? '•' + trimmed.substring(1) : trimmed;
        })
      },
      extractedFields: Object.keys(extractedData),
      note: "⚠️ IMPORTANT: Only the DATA is extracted (name, email, education, etc.). The TEMPLATE/FORMAT structure remains the same. The visual layout of your PDF is not preserved - only the text content is extracted and used in our standard template."
    };
    
    console.log("✅ Upload response prepared with", Object.keys(extractedData).length, "fields");
    return res.json(responseData);
  } catch (err) {
    console.error("❌ Upload error:", err);
    const errorMessage = err.message || "Unknown error occurred during upload";
    console.error("   Error stack:", err.stack);
    return res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
});

// Clear uploaded resume endpoint (reset to base resume)
app.post("/api/clear-uploaded-resume", async (req, res) => {
  try {
    // Clean up uploaded files
    if (UPLOADED_PDF_PATH) {
      try {
        await fs.unlink(UPLOADED_PDF_PATH);
        console.log("🗑️ Deleted uploaded PDF:", UPLOADED_PDF_PATH);
      } catch (e) {
        console.warn("⚠️ Could not delete PDF file:", e.message);
      }
    }
    
    UPLOADED_RESUME_DATA = null;
    UPLOADED_RESUME_TEXT = null;
    UPLOADED_PDF_PATH = null;
    console.log("🗑️ Uploaded resume data cleared, reverting to base resume");
    return res.json({ success: true, message: "Uploaded resume cleared, using base resume" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Debug endpoint to see what data is currently stored
app.get("/api/debug-resume-data", async (req, res) => {
  try {
    const currentData = getCurrentResumeData();
    return res.json({
      source: UPLOADED_RESUME_DATA ? "uploaded" : "base",
      hasUploadedData: !!UPLOADED_RESUME_DATA,
      hasBaseData: !!BASE_RESUME_DATA,
      currentData: {
        name: currentData?.name || "NOT SET",
        email: currentData?.email || "NOT SET",
        phone: currentData?.phone || "NOT SET",
        education: currentData?.education ? currentData.education.substring(0, 100) + "..." : "NOT SET",
        experience: currentData?.experience ? currentData.experience.substring(0, 100) + "..." : "NOT SET"
      },
      uploadedDataKeys: UPLOADED_RESUME_DATA ? Object.keys(UPLOADED_RESUME_DATA) : []
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get fixed fields endpoint - returns what won't change
app.get("/api/fixed-fields", async (req, res) => {
  try {
    const base = getCurrentResumeData() || {};
    const dataSource = UPLOADED_RESUME_DATA ? "uploaded" : "base";
    
    console.log(`📋 [FIXED-FIELDS] Requested - using data from: ${dataSource}`);
    console.log(`   Has uploaded data: ${!!UPLOADED_RESUME_DATA}`);
    console.log(`   Has base data: ${!!BASE_RESUME_DATA}`);
    console.log(`   Name: ${base.name || "NOT SET"}`);
    console.log(`   Email: ${base.email || "NOT SET"}`);
    console.log(`   Education: ${base.education ? base.education.substring(0, 50) + "..." : "NOT SET"}`);
    
    // Extract experience titles (fixed)
    const experienceLines = (base.experience || "").split('\n');
    const experienceTitles = experienceLines.filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('•') || trimmed.startsWith('-');
    }).map(line => {
      const trimmed = line.trim();
      // Convert "-" to "•" if needed
      return trimmed.startsWith('-') ? '•' + trimmed.substring(1) : trimmed;
    });
    
    const response = {
      name: base.name || "",
      email: base.email || "",
      phone: base.phone || "",
      linkedin: base.linkedin || "",
      portfolio: base.portfolio || "",
      education: base.education || "",
      certs: base.certs || "",
      experienceTitles: experienceTitles,
      source: dataSource
    };
    
    console.log(`📋 [FIXED-FIELDS] Returning data with source: ${dataSource}`);
    return res.json(response);
  } catch (err) {
    console.error("❌ Error in /api/fixed-fields:", err);
    return res.status(500).json({ error: err.message });
  }
});


// 1) Inject endpoint: directly inject user text into chosen placeholders (no LLM)
// Automatically merges fixed fields from base_resume.json or uploaded resume
// Supports PDF generation only
// request body examples:
// { "replacements": { "SUMMARY": "My exact pasted summary text\nline2", "PROJECTS": "Project A\nProject B" }, "format": "pdf" }
// or { "field": "SUMMARY", "text":"My summary...", "format": "pdf" }
app.post("/api/inject", async (req, res) => {
  try {
    const body = req.body || {};
    const format = body.format || "pdf"; // Only "pdf" is supported
    
    console.log("📋 [INJECT] Using default resume template");
    const template = await fs.readFile(TEMPLATE_PATH, "utf8");

    // Build replacements map
    let replacements = {};
    if (body.replacements && typeof body.replacements === "object") {
      replacements = body.replacements;
    } else if (body.field && typeof body.text === "string") {
      replacements[body.field] = body.text;
    } else {
      return res.status(400).json({ error: "Provide { replacements: { FIELD: text, ... } } OR { field: 'SUMMARY', text: '...' }" });
    }

    // Merge with fixed fields from current resume data (FIXED: name, contact, education, certs)
    const currentData = getCurrentResumeData();
    const dataSource = UPLOADED_RESUME_DATA ? "UPLOADED PDF" : "BASE RESUME";
    console.log(`📋 [INJECT] Using data from: ${dataSource}`);
    console.log(`   Name: ${currentData?.name || "NOT SET"}`);
    console.log(`   Email: ${currentData?.email || "NOT SET"}`);
    console.log(`   Education: ${currentData?.education ? currentData.education.substring(0, 60) + "..." : "NOT SET"}`);
    
    const fixedFields = {
      NAME: currentData?.name || "",
      EMAIL: currentData?.email || "",
      PHONE: currentData?.phone || "",
      LINKEDIN: currentData?.linkedin || "",
      PORTFOLIO: currentData?.portfolio || "",
      EDUCATION: currentData?.education || "",
      CERTS: currentData?.certs || ""
    };
    
    console.log(`📋 [INJECT] Fixed fields prepared: NAME="${fixedFields.NAME}", EMAIL="${fixedFields.EMAIL}"`);

    // VALIDATION: Check if fixed fields are complete (only validate existence, not format)
    const requiredFields = ['NAME', 'EMAIL'];
    const missingFields = requiredFields.filter(field => !fixedFields[field] || fixedFields[field].trim() === '');
    if (missingFields.length > 0) {
      const source = UPLOADED_RESUME_DATA ? "uploaded resume" : "base_resume.json";
      return res.status(400).json({ 
        error: `Missing required fixed fields: ${missingFields.join(', ')}. Please ensure ${source} has all required fields.` 
      });
    }

    // Optional: Warn if education or certs are missing, but don't block generation
    if (!fixedFields.EDUCATION || fixedFields.EDUCATION.trim() === '') {
      console.warn("⚠️ Education field is empty");
    }
    if (!fixedFields.CERTS || fixedFields.CERTS.trim() === '') {
      console.warn("⚠️ Certificates/Patents field is empty");
    }

    // Merge: user replacements override defaults, but fixed fields always come from base
    const merged = { ...fixedFields, ...replacements };

    // Convert each replacement's plain text to HTML-preserving line breaks
    // BUT: LINKEDIN and PORTFOLIO are URLs for href attributes, so don't process them
    const prepared = {};
    for (const [k, v] of Object.entries(merged)) {
      const key = k.toUpperCase();
      if (key === 'LINKEDIN' || key === 'PORTFOLIO') {
        // URLs should be plain strings - strip any HTML tags or encoding that might have been added
        let urlValue = String(v).trim();
        // Remove any HTML tags that might have been accidentally added
        urlValue = urlValue.replace(/<[^>]*>/g, '');
        // Unescape any HTML entities that might have been added
        urlValue = urlValue.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
        // Ensure it's a clean URL string
        prepared[key] = urlValue;
      } else {
        prepared[key] = textToHtmlPreserveLinebreaks(String(v));
      }
    }

    // Only PDF generation is supported
    if (format !== "pdf") {
      return res.status(400).json({ error: "Invalid format. Only 'pdf' is supported." });
    }

    // Generate PDF using the standard template
    const html = safeInjectTemplate(template, prepared);
    
    const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600 }); // Set wider viewport for contact line
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "15mm", left: "20mm", right: "20mm", bottom: "15mm" } });
    await browser.close();

    res.set({ "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=resume.pdf", "Content-Length": pdf.length });
    return res.send(pdf);
  } catch (err) {
    console.error("Inject error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 2) Generate endpoint using model to produce content for fields (ONLY replaces those placeholders)
// Automatically merges with fixed fields from base_resume.json
// request body example:
// { "description": "job description text", "fields": ["summary","experience"] }
// If fields omitted, it returns all fields from model.
app.post("/api/generate", async (req, res) => {
  try {
    const { description, fields, llmProvider, llmModel } = req.body || {};
    if (!description) return res.status(400).json({ error: "description required" });

    const currentData = getCurrentResumeData();

    const providerForLog = resolveProvider(llmProvider);
    let modelForLog = llmModel;
    if (providerForLog === "ollama") {
      modelForLog = resolveOllamaModel(llmModel);
    } else if (!modelForLog && providerForLog === "openai") {
      modelForLog = OPENAI_MODEL;
    } else if (!modelForLog && providerForLog === "gemini") {
      modelForLog = GEMINI_MODEL;
    }
    console.log(`🤖 [GENERATE] Using LLM provider: ${providerForLog}${modelForLog ? ` (model: ${modelForLog})` : ""}`);

    // Call model to get variable field contents (parsed JSON with keys summary, competencies, experience content, projects)
    const generatedFields = await callModelForFields(description, { provider: llmProvider, model: llmModel });

    // Extract experience titles from current resume data (these are FIXED, may have been paraphrased)
    const baseExperience = currentData?.experience || "";
    const experienceLines = baseExperience.split('\n');
    const experienceTitles = experienceLines.filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('•') || trimmed.startsWith('-');
    }).map(line => {
      const trimmed = line.trim();
      // Convert "-" to "•" if needed
      return trimmed.startsWith('-') ? '•' + trimmed.substring(1) : trimmed;
    });
    
    // VALIDATION: Check if basic required fields exist before generation
    if (!currentData?.name || !currentData?.email) {
      const source = UPLOADED_RESUME_DATA ? "uploaded resume" : "base_resume.json";
      return res.status(400).json({ 
        error: `Missing required fields (name, email) in ${source}. Please ensure all required fields are present.` 
      });
    }
    
    // Optional: Warn if education or certs are missing, but don't block generation
    if (!currentData?.education || currentData.education.trim() === '') {
      console.warn("⚠️ Education field is empty - generation will proceed");
    }
    if (!currentData?.certs || currentData.certs.trim() === '') {
      console.warn("⚠️ Certificates/Patents field is empty - generation will proceed");
    }
    
    // Reconstruct experience: titles (fixed) + generated content
    // Ensure all experience items have bullet points with "•"
    let finalExperience = "";
    if (generatedFields.experience && experienceTitles.length > 0) {
      // Combine fixed titles with generated content
      // Ensure generated content lines start with "•"
      const generatedLines = generatedFields.experience.split('\n').filter(l => l.trim());
      const formattedGenerated = generatedLines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('•')) return trimmed;
        if (trimmed.startsWith('-')) return '•' + trimmed.substring(1);
        return `• ${trimmed}`;
      }).join('\n');
      finalExperience = experienceTitles.join('\n') + '\n' + formattedGenerated;
    } else if (generatedFields.experience) {
      // Ensure all lines have bullet points with "•"
      const lines = generatedFields.experience.split('\n').filter(l => l.trim());
      finalExperience = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('•')) return trimmed;
        if (trimmed.startsWith('-')) return '•' + trimmed.substring(1);
        return `• ${trimmed}`;
      }).join('\n');
    } else {
      finalExperience = baseExperience; // fallback to base
    }
    
    // Ensure projects have bullet points with "•"
    if (generatedFields.projects) {
      const projectLines = generatedFields.projects.split('\n').filter(l => l.trim());
      generatedFields.projects = projectLines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('•')) return trimmed;
        if (trimmed.startsWith('-')) return '•' + trimmed.substring(1);
        return `• ${trimmed}`;
      }).join('\n');
    }

    // Merge generated fields with experience reconstruction
    const mergedFields = {
      ...generatedFields,
      experience: finalExperience
    };

    // If user requested a subset of fields, filter
    let result;
    if (Array.isArray(fields) && fields.length) {
      result = {};
      for (const k of fields) {
        if (mergedFields.hasOwnProperty(k)) {
          result[k] = mergedFields[k];
        }
      }
    } else {
      result = mergedFields;
    }
  
    return res.json(result);
  } catch (err) {
    console.error("Generate error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 404 handler for undefined routes - MUST BE LAST (after all routes)
app.use((req, res, next) => {
  console.log(`\n❌ ===== 404 ROUTE NOT FOUND =====`);
  console.log(`   Method: ${req.method}`);
  console.log(`   Path: ${req.path}`);
  console.log(`   Original URL: ${req.originalUrl}`);
  console.log(`   Query:`, req.query);
  console.log(`   Content-Type: ${req.headers["content-type"]}`);
  
  // List all registered routes for debugging (compatible with Express 5)
  const registeredRoutes = [];
  try {
    if (app._router && app._router.stack) {
      app._router.stack.forEach((middleware) => {
        if (middleware.route) {
          const methods = Object.keys(middleware.route.methods);
          registeredRoutes.push(`${methods[0].toUpperCase()} ${middleware.route.path}`);
        }
      });
    }
  } catch (err) {
    console.warn("Could not list routes:", err.message);
  }
  
  if (registeredRoutes.length > 0) {
    console.log(`   Registered routes:`, registeredRoutes);
  } else {
    console.log(`   Registered routes: (Express 5 - check /api/routes endpoint)`);
  }
  console.log(`=====================================\n`);
  
  res.status(404).json({ 
    error: `Route not found: ${req.method} ${req.path}`,
    registeredRoutes: registeredRoutes.length > 0 ? registeredRoutes : "Check /api/routes endpoint",
    hint: "Make sure the server was restarted after code changes. Check /api/routes endpoint."
  });
});

// Global error handler - MUST BE AFTER 404 handler
app.use((err, req, res, next) => {
  console.error("\n❌ ===== UNHANDLED ERROR =====");
  console.error("   Error:", err.message);
  console.error("   Stack:", err.stack);
  console.error("===============================\n");
  res.status(500).json({ error: err.message || "Internal server error" });
});

// Start server with route verification
const server = app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 SERVER STARTED SUCCESSFULLY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📍 Server URL: http://localhost:${PORT}`);
  console.log(`📂 Server directory: ${__dirname}`);
  console.log(`📄 Template path: ${TEMPLATE_PATH}`);
  console.log(`📋 Base resume path: ${BASE_RESUME_PATH}`);
  console.log(`📁 Uploads directory: ${UPLOADS_DIR}`);
  console.log(`\n📋 VERIFYING REGISTERED ROUTES...\n`);
  
  // Collect all registered routes (compatible with Express 4 and 5)
  const routes = [];
  try {
    // Try Express 4/5 router structure
    if (app._router && app._router.stack) {
      app._router.stack.forEach((middleware) => {
        if (middleware.route) {
          const methods = Object.keys(middleware.route.methods);
          routes.push(`${methods[0].toUpperCase()} ${middleware.route.path}`);
        } else if (middleware.name === 'router') {
          // Handle router middleware (Express 5)
          if (middleware.handle && middleware.handle.stack) {
            middleware.handle.stack.forEach((handler) => {
              if (handler.route) {
                const methods = Object.keys(handler.route.methods);
                const path = (middleware.regexp.source.match(/^\/\^?\\?\/?(.*)\\?\//) || [])[1] || '';
                routes.push(`${methods[0].toUpperCase()} ${path}${handler.route.path}`);
              }
            });
          }
        }
      });
    }
  } catch (err) {
    console.warn("⚠️ Could not list routes (Express 5 may have different structure):", err.message);
  }
  
  // Display all routes
  if (routes.length > 0) {
    routes.forEach(route => {
      console.log(`   ✅ ${route}`);
    });
  } else {
    console.log(`   ℹ️  Route listing not available (Express 5 compatibility)`);
    console.log(`   ℹ️  Routes are registered - test endpoints to verify`);
  }
  
  // Verify critical routes exist
  console.log(`\n🔍 VERIFICATION:`);
  const uploadRouteExists = routes.length === 0 || routes.some(r => r.includes('POST /api/upload-resume'));
  const healthRouteExists = routes.length === 0 || routes.some(r => r.includes('GET /api/health'));
  
  if (uploadRouteExists || routes.length === 0) {
    console.log(`   ✅ Upload route: POST /api/upload-resume`);
  } else {
    console.error(`   ❌ MISSING: POST /api/upload-resume`);
  }
  
  if (healthRouteExists || routes.length === 0) {
    console.log(`   ✅ Health check: GET /api/health`);
  } else {
    console.error(`   ❌ MISSING: GET /api/health`);
  }
  
  console.log(`\n${'='.repeat(60)}`);
  if (routes.length > 0) {
    console.log(`📊 Total routes registered: ${routes.length}`);
  } else {
    console.log(`📊 Routes registered (Express 5 - structure may differ)`);
  }
  console.log(`${'='.repeat(60)}\n`);
  
  console.log(`✅ Server is ready to accept requests!`);
  console.log(`   Test endpoints:`);
  console.log(`   - GET  http://localhost:${PORT}/api/health`);
  console.log(`   - POST http://localhost:${PORT}/api/upload-resume`);
  console.log(`   - GET  http://localhost:${PORT}/api/routes\n`);
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ ERROR: Port ${PORT} is already in use!`);
    console.error(`   Please stop the other server or change PORT in .env file\n`);
  } else {
    console.error(`\n❌ SERVER ERROR:`, err);
  }
  process.exit(1);
});
