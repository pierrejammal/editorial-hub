import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { BrandHeader } from "@/components/BrandHeader";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { ScorePanel } from "@/components/ScorePanel";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { CaptionEditor } from "@/components/CaptionEditor";
import { VisualPreview } from "@/components/VisualPreview";
import { PostActions } from "@/components/PostActions";
import { FactCheckPanel } from "@/components/FactCheckPanel";
import { EnglishVersionButton } from "@/components/EnglishVersionButton";
import { useStudio } from "@/context/StudioContext";
import { savePost } from "@/lib/api";
import { buildSavePayload } from "@/lib/postPayload";
import { ArrowLeft, Check, Loader2, CloudOff } from "lucide-react";

const Studio = () => {
  const { post, setPost } = useStudio();
  const nav = useNavigate();
  const [thumb, setThumb] = useState("");
  const [controlsSlot, setControlsSlot] = useState(null); // left-column spot for the visual's settings

  useEffect(() => {
    if (!post) nav("/");
  }, [post, nav]);

  // Autosave: every change of a saved post is written to "Mes posts" 1.5 s after the last edit,
  // so leaving the Studio or generating another post never loses the work.
  const [saveState, setSaveState] = useState("idle"); // idle | pending | saved | error
  const thumbRef = useRef(thumb);
  thumbRef.current = thumb;
  const firstRun = useRef(true);
  useEffect(() => {
    if (!post?.id) return undefined;
    if (firstRun.current) { firstRun.current = false; return undefined; }
    setSaveState("pending");
    const t = setTimeout(async () => {
      try {
        await savePost(buildSavePayload(post, {
          thumb: thumbRef.current, origin: post.origin || "studio", scheduled_at: post.scheduled_at,
        }));
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [post]);

  if (!post) return null;
  const meta = post.meta || {};

  return (
    <div className="min-h-screen paper-grain">
      <BrandHeader />
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/"
            data-testid="studio-back"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-forsides-slate hover:text-forsides-red"
          >
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
          {post.id && (
            <span data-testid="autosave-state" className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              {saveState === "pending" && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enregistrement…</>}
              {saveState === "error" && <><CloudOff className="h-3.5 w-3.5 text-forsides-red" /> Enregistrement automatique impossible, utilisez « Enregistrer »</>}
              {(saveState === "saved" || saveState === "idle") && <><Check className="h-3.5 w-3.5 text-emerald-600" /> Enregistré dans Mes posts</>}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden lg:block">
              <WorkflowStepper active={7} />
            </div>
            <EnglishVersionButton post={post} setPost={setPost} thumb={thumb} />
            <PostActions post={post} thumb={thumb} origin="studio"
              onSaved={(id, scheduled_at) => setPost((p) => ({ ...p, id, scheduled_at }))} />
          </div>
        </div>

        <div className="mt-6 rise">
          <div className="flex flex-wrap items-center gap-3">
            {meta.sector && (
              <span className="rounded-full bg-forsides-ink px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-white">
                {meta.sector}
              </span>
            )}
            {meta.source && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                {meta.source}
              </span>
            )}
            {meta.lang === "en" && (
              <span data-testid="studio-lang-en" className="rounded-full bg-forsides-red px-2.5 py-0.5 font-mono text-[10px] font-bold text-white">EN</span>
            )}
            {meta.date_label && (
              <span className="font-mono text-[11px] text-slate-400">· {meta.date_label}</span>
            )}
          </div>
          <h1 className="mt-2 max-w-4xl font-serif text-3xl font-black leading-tight tracking-tight text-forsides-ink sm:text-4xl">
            {post.visual?.title_short || meta.topic || post.editorial?.fact}
          </h1>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <ScorePanel scoring={post.scoring} />
            <AnalysisPanel editorial={post.editorial} meta={meta} sources={post.sources} />
            <CaptionEditor />
            <div ref={setControlsSlot} />
            <FactCheckPanel post={post} />
          </div>
          {/* Frozen right column: always the full height of the screen, the visual shrinks to fit
              inside it; only the left column scrolls (like "Figer les volets" in Excel). */}
          <div className="order-first lg:order-none lg:sticky lg:top-[5.25rem] lg:h-[calc(100vh-6rem)] lg:self-start">
            <VisualPreview onThumb={setThumb} controlsTarget={controlsSlot} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Studio;
