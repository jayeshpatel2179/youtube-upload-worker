import express from "express";
import axios from "axios";
import { google } from "googleapis";
import multer from "multer";

const app = express();

// IMPORTANT for large uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// multer for binary upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB thumbnail limit
});

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
app.post("/upload", upload.single("thumbnail"), async (req, res) => {

  // respond immediately (Render timeout protection)
  res.json({ status: "upload_started" });

  (async () => {
    try {

      const frameLink = req.body.frameLink;
      const title = req.body.title;
      const description = req.body.description;

      // SAFE TAG PARSE
      let tags = [];
      try {
        tags = Array.isArray(req.body.tags)
          ? req.body.tags
          : JSON.parse(req.body.tags || "[]");
      } catch {
        tags = [];
      }

      console.log("Starting upload:", title);

      /*
      ------------------------------------
      STREAM VIDEO FROM FRAME.IO
      ------------------------------------
      */
      const videoStream = await axios({
        method: "GET",
        url: frameLink,
        responseType: "stream"
      });

      /*
      ------------------------------------
      UPLOAD VIDEO (UNLISTED)
      ------------------------------------
      */
      const uploadResponse = await youtube.videos.insert({
        part: "snippet,status",
        requestBody: {
          snippet: {
            title,
            description,
            tags
          },
          status: {
            privacyStatus: "unlisted"
          }
        },
        media: {
          body: videoStream.data
        }
      });

      const videoId = uploadResponse.data.id;
      console.log("Video uploaded:", videoId);

      /*
      ------------------------------------
      WAIT BEFORE THUMBNAIL (IMPORTANT)
      ------------------------------------
      */
      await new Promise(resolve => setTimeout(resolve, 8000));

      /*
      ------------------------------------
      UPLOAD THUMBNAIL
      ------------------------------------
      */
      if (req.file) {
        console.log("Uploading thumbnail...");

        await youtube.thumbnails.set({
          videoId,
          media: {
            mimeType: req.file.mimetype,
            body: Buffer.from(req.file.buffer)
          }
        });

        console.log("Thumbnail uploaded successfully");
      }

      /*
      ------------------------------------
      SEND SUCCESS BACK TO N8N
      ------------------------------------
      */
      if (process.env.N8N_WEBHOOK_URL) {
        await axios.post(process.env.N8N_WEBHOOK_URL, {
          status: "success",
          videoId,
          title
        });

        console.log("Webhook sent");
      }

    } catch (err) {

      const errorMessage =
        err.response?.data?.error?.message ||
        err.message ||
        "Upload failed";

      console.error("Upload failed:", errorMessage);

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
