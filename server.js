import express from "express";
import axios from "axios";
import { google } from "googleapis";

const app = express();
app.use(express.json());

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_ACCESS_TOKEN
});

app.post("/upload", async (req, res) => {
  try {
    const { frameLink, title, description, tags } = req.body;

    const videoStream = await axios({
      method: "GET",
      url: frameLink,
      responseType: "stream"
    });

    const response = await youtube.videos.insert({
      part: "snippet,status",
      requestBody: {
        snippet: {
          title,
          description,
          tags
        },
        status: {
          privacyStatus: "public"
        }
      },
      media: {
        body: videoStream.data
      }
    });

    res.json({ videoId: response.data.id });

  } catch (err) {
    console.error(err);
    res.status(500).send("Upload failed");
  }
});

app.listen(3000, () => console.log("Server running"));
