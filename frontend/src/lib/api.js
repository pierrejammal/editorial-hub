import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const http = axios.create({ baseURL: API, timeout: 60000 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Start an async job then poll until done — bypasses the 60s edge timeout.
// onProgress(step) is called each time the server reports a new phase ("fetch", "ai", …).
async function runJob(path, payload, { interval = 2000, maxMs = 240000, onProgress } = {}) {
  const { data } = await http.post(path, payload);
  const jobId = data.job_id;
  const deadline = Date.now() + maxMs;
  let failures = 0;
  let lastStep = null;
  while (Date.now() < deadline) {
    await sleep(interval);
    let job;
    try {
      ({ data: job } = await http.get(`/jobs/${jobId}`));
      failures = 0;
    } catch (e) {
      // A brief network hiccup while polling shouldn't throw away a job that is still running.
      if (e.response?.status === 404 || ++failures >= 4) throw e;
      continue;
    }
    if (job.step && job.step !== lastStep) {
      lastStep = job.step;
      onProgress?.(job.step);
    }
    if (job.status === "done") return job.result;
    if (job.status === "error") {
      const err = new Error(job.detail || "Traitement échoué");
      err.detail = job.detail;
      throw err;
    }
  }
  throw new Error("Délai dépassé, réessayez.");
}

// tone: "standard" | "expert" | "pedagogique" | "alerte" | null (house default)
export const analyzeUrl = (url, length = "standard", { tone, onProgress } = {}) =>
  runJob("/jobs/analyze-url", { url, length, tone: tone || null }, { onProgress });

export const searchTopics = (payload, { onProgress } = {}) => runJob("/jobs/search", payload, { onProgress });

export const analyzeTopic = (topic, length = "standard", { tone, onProgress } = {}) =>
  runJob("/jobs/analyze-topic", { topic, length, tone: tone || null }, { onProgress });

export const composeFromText = (caption, { onProgress } = {}) =>
  runJob("/jobs/compose", { caption }, { onProgress });

export const getStyle = () => http.get("/settings/style").then((r) => r.data);
export const saveStyle = (style) => http.put("/settings/style", style).then((r) => r.data);

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

export const duplicatePost = (id) => http.post(`/posts/${id}/duplicate`).then((r) => r.data);

export const translatePost = (content) => http.post("/translate", { content }, { timeout: 120000 }).then((r) => r.data);
