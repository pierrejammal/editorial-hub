import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { BrandHeader } from "@/components/BrandHeader";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { ScorePanel } from "@/components/ScorePanel";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { CaptionEditor } from "@/components/CaptionEditor";
import { VisualPreview } from "@/components/VisualPreview";
import { PostActions } from "@/components/PostActions";
import { useStudio } from "@/context/StudioContext";
import { ArrowLeft } from "lucide-react";

const Studio = () => {
  const { post, setPost } = useStudio();
  const nav = useNavigate();
  const [thumb, setThumb] = useState("");

  useEffect(() => {
    if (!post) nav("/");
  }, [post, nav]);

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
          <div className="flex items-center gap-4">
            <div className="hidden lg:block">
              <WorkflowStepper active={7} />
            </div>
            <PostActions post={post} thumb={thumb} origin="studio" onSaved={(id) => setPost((p) => ({ ...p, id }))} />
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
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <VisualPreview onThumb={setThumb} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Studio;
