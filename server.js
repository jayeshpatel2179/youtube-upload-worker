import express from "express";
import axios from "axios";
import { google } from "googleapis";

const app = express();
app.use(express.json());

/*
------------------------------------
YouTube Client
------------------------------------
*/
const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_ACCESS_TOKEN
});


/*
------------------------------------
UPLOAD ENDPOINT
------------------------------------
*/
app.post("/upload", async (req, res) => {

  // ✅ respond immediately (IMPORTANT)
  res.json({
    status: "upload_started"
  });

  // run upload in background
  (async () => {
    try {

      const { frameLink, title, description, tags } = req.body;

      console.log("Starting upload:", title);

      // stream video from frame.io
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

      console.log("Upload completed:", response.data.id);

    } catch (err) {
      console.error("Upload failed:", err.response?.data || err.message);
    }
  })();

});


/*
------------------------------------
HEALTH CHECK (OPTIONAL)
------------------------------------
*/
app.get("/", (req, res) => {
  res.send("Upload worker running");
});


/*
------------------------------------
START SERVER
------------------------------------
*/
app.listen(3000, () => {
  console.log("Upload worker running on port 3000");
});