import React, { createContext, useContext, useState } from "react";

const StudioContext = createContext(null);

export const StudioProvider = ({ children }) => {
  const [post, setPost] = useState(null);
  const [research, setResearch] = useState({
    params: null,
    topics: [],
    excluded: [],
    candidatesCount: 0,
  });

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
