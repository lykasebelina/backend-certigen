//backend/server/server.js
const express = require("express");
const fetch = require("node-fetch"); // npm install node-fetch
const cors = require("cors");


const app = express();
const PORT = process.env.PORT || 4000;


// Enable CORS for localhost:5173 (your frontend)
app.use(
 cors({
   origin: "http://localhost:5173", // adjust to your frontend origin
 })
);


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


