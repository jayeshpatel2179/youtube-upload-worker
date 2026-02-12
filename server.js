import express from "express";
import axios from "axios";
import { google } from "googleapis";

const app = express();
app.use(express.json());

/*
------------------------------------
YouTube OAuth2 Client
------------------------------------
*/
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.REFRESH_TOKEN
});

const youtube = google.youtube({
  version: "v3",
  auth: oauth2Client
});


/*
------------------------------------
UPLOAD ENDPOINT
------------------------------------
*/
app.post("/upload", async (req, res) => {

  // respond immediately (prevents Render timeout)
  res.json({
    status: "upload_started"
  });

  // background upload
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

      const videoId = response.data.id;

      console.log("Upload completed:", videoId);

      // ✅ send success back to n8n
      if (process.env.N8N_WEBHOOK_URL) {
        await axios.post(process.env.N8N_WEBHOOK_URL, {
          status: "success",
          videoId,
          title
        });
      }

    } catch (err) {

      const errorMessage =
        err.response?.data?.error?.message ||
        err.message ||
        "Upload failed";

      console.error("Upload failed:", errorMessage);

      // ✅ send failure back to n8n
      if (process.env.N8N_WEBHOOK_URL) {
        await axios.post(process.env.N8N_WEBHOOK_URL, {
          status: "failed",
          error: errorMessage
        });
      }
    }
  })();

});


/*
------------------------------------
HEALTH CHECK
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
