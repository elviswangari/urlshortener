require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const dns = require("dns");
const { promisify } = require("util");
const lookup = promisify(dns.lookup);
const { Schema } = mongoose;

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL);

// Create URL schema
const urlSchema = new Schema({
  original_url: String,
  short_url: Number,
});

// Create a model
const Url = mongoose.model("Url", urlSchema);

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

// Endpoint to create a short URL
app.post('/api/shorturl', async (req, res) => {
  const originalUrl = req.body.url;
  
  try {
    // Check if the URL is valid
    const httpRegex = /^(http|https)(:\/\/)/;
    if (!httpRegex.test(originalUrl)) {
      return res.json({ error: 'invalid url' })
    }
    

    // Verify the URL
    const { hostname } = new URL(originalUrl);
    await lookup(hostname);

    // Check if the URL already exists in the database
    let existingUrl = await Url.findOne({ original_url: originalUrl });
    if (existingUrl) {
      return res.json({
        original_url: existingUrl.original_url,
        short_url: existingUrl.short_url
      });
    }

    // Generate short URL
    const shortUrl = Math.floor(Math.random() * 10000);

    // Create new URL document
    const newUrl = new Url({
      original_url: originalUrl,
      short_url: shortUrl
    });

    // Save the URL to the database
    await newUrl.save();

    // Send response
    res.json({
      original_url: newUrl.original_url,
      short_url: newUrl.short_url
    });
  } catch (err) {
    console.error(err);
    if (err.code === "ENOTFOUND") {
      return res.status(400).json({ error: 'invalid url' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to redirect to original URL based on short URL
app.get('/api/shorturl/:shortUrl', async (req, res) => {
  const shortUrl = req.params.shortUrl;

  try {
    // Find the URL document with the given short URL
    const urlDocument = await Url.findOne({ short_url: shortUrl });
    if (!urlDocument) {
      return res.status(404).json({ error: 'Short URL not found' });
    }

    // Redirect to the original URL
    res.redirect(urlDocument.original_url);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
