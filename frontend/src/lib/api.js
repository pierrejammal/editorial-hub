import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const http = axios.create({ baseURL: API, timeout: 60000 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Start an async job then poll until done — bypasses the 60s edge timeout.
async function runJob(path, payload, { interval = 3000, maxMs = 240000 } = {}) {
  const { data } = await http.post(path, payload);
  const jobId = data.job_id;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await sleep(interval);
    const { data: job } = await http.get(`/jobs/${jobId}`);
    if (job.status === "done") return job.result;
    if (job.status === "error") {
      const err = new Error(job.detail || "Traitement échoué");
      err.detail = job.detail;
      throw err;
    }
  }
  throw new Error("Délai dépassé, réessayez.");
}

export const analyzeUrl = (url, length = "standard") =>
  runJob("/jobs/analyze-url", { url, length });

export const searchTopics = (payload) => runJob("/jobs/search", payload);

export const analyzeTopic = (topic, length = "standard") =>
  runJob("/jobs/analyze-topic", { topic, length });

export const composeFromText = (caption) =>
  runJob("/jobs/compose", { caption });

export const regenCaption = (payload) =>
  http.post("/caption", payload).then((r) => r.data);

export const checkQuality = (caption, context) =>
  http.post("/quality", { caption, context }).then((r) => r.data);

export const genVisual = (payload) =>
  http.post("/visual-image", payload).then((r) => r.data);

export const savePost = (payload) =>
  http.post("/posts/save", payload).then((r) => r.data);

export const listPosts = () => http.get("/posts").then((r) => r.data.posts);

export const getPost = (id) => http.get(`/post/${id}`).then((r) => r.data);

export const deletePost = (id) => http.delete(`/posts/${id}`).then((r) => r.data);
