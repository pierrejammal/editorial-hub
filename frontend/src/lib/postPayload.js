// What "Enregistrer" sends to the server for a post (shared by every save button).
export const buildSavePayload = (post, { thumb = "", origin = "studio", scheduled_at = null } = {}) => ({
  id: post.id || null,
  title: post.visual?.title_short || post.meta?.topic || "Post FORSIDES",
  caption: post.caption || "",
  thumbnail: thumb || "",
  meta: post.meta || {},
  scoring: post.scoring || null,
  editorial: post.editorial || null,
  visual: post.visual || null,
  quality: post.quality || null,
  sources: post.sources || null,
  scheduled_at: scheduled_at || null,
  origin,
  source_text: post.source_text || "",
});
