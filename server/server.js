// backend/server/server.js
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");


const app = express();
const PORT = process.env.PORT || 4000;


// --- CORS Configuration Update ---
const ALLOWED_ORIGINS = [
  "https://certigen.site", // Your Live Hostinger Site
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
    credentials: true, // You may need this if you use cookies or auth headers
  })
);
// ---------------------------------


// Proxy endpoint
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


app.listen(PORT, () => {
 console.log(`Proxy server running at http://localhost:${PORT}`);
});