import express from "express";
import cors from "cors";
import OpenAI from "openai";
import dotenv from "dotenv";


dotenv.config();


const app = express();
app.use(cors());
app.use(express.json());




const client = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY, // safe on server
});


// API endpoint: POST /extract
app.post("/extract", async (req, res) => {
 try {
   const { prompt } = req.body;
   if (!prompt) return res.status(400).json({ error: "No prompt provided" });


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
app.post("/rephrase", async (req, res) => {
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
app.post("/extract-date", async (req, res) => {
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




// Start server
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`AI extractor server running on port ${port}`));


