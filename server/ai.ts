import express from "express";
import cors from "cors";
import OpenAI from "openai";
import dotenv from "dotenv";
import fetch from "node-fetch"; // Make sure node-fetch is still needed and installed if using ES Modules

// Since you were originally using require, I'll keep the module style consistent with that:
// const express = require("express");
// const cors = require("cors");
// const OpenAI = require("openai");
// const dotenv = require("dotenv");
// const fetch = require("node-fetch"); // Or remove if not needed for the proxy, but looks necessary

dotenv.config();

const app = express();
// const PORT = process.env.PORT || 4000; // Removed as it's defined at the bottom

// --- CORS Configuration (Option 2 - Robust) ---
const ALLOWED_ORIGINS = [
  "https://lawngreen-fish-109745.hostingersite.com", // Your Live Hostinger Site (Current)
  "https://navajowhite-beaver-664626.hostingersite.com", // Your Live Hostinger Site (Previous, kept for safety)
  "http://localhost:5173",                               // Your Local Development
];

// Enable CORS for multiple origins
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  })
);
// ---------------------------------------------


app.use(express.json());

const client = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY, // safe on server
});


// API endpoint: POST /api/extract
app.post("/api/extract", async (req, res) => {
 try {
   const { prompt } = req.body;
   
   // --- CRITICAL FIX FOR 400 ERROR ---
   // Check if prompt is missing, not a string, or is empty/whitespace only
   if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
     return res.status(400).json({ error: "No valid prompt provided" });
   }
   // ----------------------------------


   const response = await client.responses.create({
     model: "gpt-5.1",
     input: `
    You are an expert academic certificate writer.


Extract and generate all certificate fields from this user prompt:




"${prompt}"


Follow these STRICT RULES to prevent redundancy and maintain proper certificate structure:


========================
     FIELD RULES
========================


1. institution 
  - Full institution name only.


2. department 
  - College, office, or department only.


3. location 
  - Full city/campus/location only.


4. openingPhrase
  - MUST be exactly: "This".
  - DO NOT generate any other words or variations.
 


5. certificateTitle 
  - MUST be ONLY the formal title of the certificate.
  - Examples:
      "Certificate of Completion"
      "Certificate of Appreciation"
      "Certificate of Participation"
  - No extra words.
  - No introductory phrases.
  - No verbs.


6. preRecipientPhrase 
  - ONLY a connector phrase placed directly before the recipient name.
  - Verb words
  - Examples:
      "is hereby awarded to"
      "is hereby given to"
      "is presented to"
      "to"
  - Must NOT repeat the certificate title.
  - Must NOT mention the reason or role.


7. recipientName 
  - Full complete name only.
  - No titles unless explicitly provided in the prompt.


8. purposePhrase 
  - ONLY the line stating the reason for recognition.
  - A short phrase that leads into the role.
  - Examples:
      "in grateful recognition of her invaluable contribution as"
      "for his outstanding service as"
  - Must NOT contain event details, dates, or venue.


9. role 
  - ONLY the role, designation or program.
  - Examples:
      "Resource Speaker"
      "Participant"
      "Awardee"
      "CIVIL SERVICE EXAMINATION EXAM"
  - No sentences, no descriptions.


10. eventDetails 
   - ONE complete, formal sentence.
   - Describes the event, theme, purpose, date, and venue.
   - Must NOT repeat any purposePhrase text.
   - Must NOT include any names or signatures.


11. datePlace 
   - The final awarding line.
   - Format:
      "Given this [Date] at [Venue]."


12. signatures 
   - List of objects with "name" and "title".
   - No extra notes or explanations.


========================
     OUTPUT RULES
========================


- ALWAYS return valid JSON only.
- No markdown, no commentary, no explanations.
- If information is missing, create clean, formal academic filler text.
- Ensure proper honorifics where appropriate.
- Avoid ANY redundancy between fields.
- Keep all text concise and certificate-friendly.


========================
REQUIRED JSON STRUCTURE
========================


{
 "institution": "",
 "department": "",
 "location": "",
 "openingPhrase": "",
 "certificateTitle": "",
 "preRecipientPhrase": "",
 "recipientName": "",
 "purposePhrase": "",
 "role": "",
 "eventDetails": "",
 "datePlace": "",
 "signatures": [
   { "name": "", "title": "" }
 ]
}


     `
   });


   const json = response.output_text.trim();
   const parsed = JSON.parse(json);
parsed.openingPhrase = "This";
   res.json(parsed);


 } catch (err) {
   console.error(err);
   res.status(500).json({ error: "AI extraction failed" });
 }
});


// API endpoint: POST /rephrase
app.post("/api/rephrase", async (req, res) => {
 try {
   const { text, maxChars, guidance } = req.body;
   if (!text) return res.status(400).json({ error: "No text provided" });
   // Basic guard
   const safeMax = typeof maxChars === "number" && maxChars > 0 ? Math.min(maxChars, 370) : undefined;


   // Compose prompt for the model
   const instruction = `
You are a concise formal writer for academic certificates.
Shorten the following text so that it preserves meaning, formal tone, and any names/dates present,
and so that the final result does not exceed ${safeMax ?? "the requested"} characters.


${guidance ?? ""}


Original text:
"""${text}"""
Return only the shortened text (no markdown, no explanation).
`;


   const response = await client.responses.create({
     model: "gpt-5.1",
     input: instruction,
     max_output_tokens: 800,
   });


   const raw = response.output_text?.trim?.() ?? "";
   // If model returns JSON-like object, try minimal parsing; otherwise, pass raw text
   const rephrasedText = raw;


   return res.json({ rephrasedText });
 } catch (err) {
   console.error("Rephrase failed:", err);
   return res.status(500).json({ error: "Rephrase failed" });
 }
});


// ⭐️ NEW AI ENDPOINT: POST /extract-date ⭐️
app.post("/api/extract-date", async (req, res) => {
 try {
   const { rawText } = req.body;
   if (!rawText) return res.status(400).json({ error: "No rawText provided" });


   // 🏆 FIXED INSTRUCTION: Outputs "Month Day, Year"
   const instruction = `
You are an expert date parser.
From the following text, extract ONLY the date.
The final output MUST be in the format: Month Day, Year (e.g., "December 2, 2025").
DO NOT include any text, ordinal suffixes (like "nd" or "th"), prefixes (like "Given this"), or location details (like "at Plainfield City").
Return ONLY the formatted date string.


Raw Text:
"""${rawText}"""
`;


   const response = await client.responses.create({
     model: "gpt-5.1",
     input: instruction,
   });


   const extractedDate = response.output_text?.trim?.() ?? "Date Extraction Failed";


   return res.json({ extractedDate });
 } catch (err) {
   console.error("Date extraction failed:", err);
   res.status(500).json({ error: "AI date extraction failed" });
 }
});


// Proxy endpoint (original path, preserved)
app.get("/api/proxy-image", async (req, res) => {
 const { url } = req.query;
 if (!url) return res.status(400).send("Missing url query param");


 try {
   // Fetch the DALL·E private image
   const response = await fetch(url);
   if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
   const buffer = await response.arrayBuffer();


   // Infer content type from response headers or fallback to png
   const contentType = response.headers.get("content-type") || "image/png";
   res.set("Content-Type", contentType);


   // Send the image buffer to frontend
   res.send(Buffer.from(buffer));
 } catch (err) {
   console.error("Proxy error:", err);
   res.status(500).send("Failed to fetch image");
 }
});


// Start server
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`AI extractor server running on port ${port}`));