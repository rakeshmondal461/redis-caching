import express from "express";
import { createClient } from "redis";
import axios from "axios";

const app = express();
const port = 3000;

const init = async () => {
  // Create Redis client
  const redisClient = createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  });

  // Handle Redis connection errors
  redisClient.on("error", (err) => console.error("Redis Client Error", err));

  // Connect to Redis
  await redisClient.connect();

  // Middleware to parse JSON
  app.use(express.json());

  // API endpoint with caching
  app.get("/posts/:id", (req, res) => {
    const postId = req.params.id;
    const cacheKey = `post:${postId}`;

    (async () => {
      try {
        // Check cache
        const cachedPost = await redisClient.get(cacheKey);
        if (cachedPost) {
          console.log("Getting data from cache 💾");
          return res.json(JSON.parse(cachedPost));
        }

        // Cache miss: Fetch from API
        console.log("Getting data from API 🖥️");
        const response = await axios.get(
          `https://jsonplaceholder.typicode.com/posts/${postId}`
        );
        const post = response.data;

        // Store in cache with 1-hour expiration
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(post));

        res.json(post);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    })();
  });

  // Start the server
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
};

init();