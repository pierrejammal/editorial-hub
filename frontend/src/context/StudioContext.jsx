import React, { createContext, useContext, useEffect, useState } from "react";

const StudioContext = createContext(null);

// Work in progress is kept in the browser tab's session storage, so changing page from the menu,
// refreshing or an accidental reload never loses the current post, the veille results or the
// text being written in the free editor.
const KEYS = { post: "forsides.studio.post", research: "forsides.research", compose: "forsides.compose" };

const read = (key, fallback) => {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const usePersisted = (key, fallback) => {
  const [value, setValue] = useState(() => read(key, fallback));
  useEffect(() => {
    try {
      if (value == null) window.sessionStorage.removeItem(key);
      else window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or blocked (private mode): the app still works, just without restore
    }
  }, [key, value]);
  return [value, setValue];
};

const EMPTY_RESEARCH = { params: null, topics: [], excluded: [], candidatesCount: 0 };

export const StudioProvider = ({ children }) => {
  const [post, setPost] = usePersisted(KEYS.post, null);
  const [research, setResearch] = usePersisted(KEYS.research, EMPTY_RESEARCH);
  const [compose, setCompose] = usePersisted(KEYS.compose, null); // { text, post } of the free editor

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
        compose,
        setCompose,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
};

export const useStudio = () => useContext(StudioContext);
