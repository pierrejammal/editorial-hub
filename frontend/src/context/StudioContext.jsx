import React, { createContext, useContext, useEffect, useState } from "react";

const StudioContext = createContext(null);

// The post being edited is kept in the browser tab's session storage, so refreshing
// the Studio page (or an accidental reload) no longer sends you back to the home page
// and loses your caption edits.
const STORAGE_KEY = "forsides.studio.post";

const readStoredPost = () => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const StudioProvider = ({ children }) => {
  const [post, setPost] = useState(readStoredPost);
  const [research, setResearch] = useState({
    params: null,
    topics: [],
    excluded: [],
    candidatesCount: 0,
  });

  useEffect(() => {
    try {
      if (post) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(post));
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage full or blocked (private mode): the app still works, just without restore
    }
  }, [post]);

  const updateCaption = (caption) =>
    setPost((p) => (p ? { ...p, caption } : p));
  const updateQuality = (quality) =>
    setPost((p) => (p ? { ...p, quality } : p));
  const updateVisual = (patch) =>
    setPost((p) => (p ? { ...p, visual: { ...p.visual, ...patch } } : p));

  return (
    <StudioContext.Provider
      value={{
        post,
        setPost,
        updateCaption,
        updateQuality,
        updateVisual,
        research,
        setResearch,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
};

export const useStudio = () => useContext(StudioContext);
