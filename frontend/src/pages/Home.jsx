import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BrandHeader } from "@/components/BrandHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LoadingWorkflow } from "@/components/LoadingWorkflow";
import { VisualCanvas } from "@/components/VisualCanvas";
import { useStudio } from "@/context/StudioContext";
import { analyzeUrl, composeFromText } from "@/lib/api";
import { useTone } from "@/lib/tone";
import { useReveal } from "@/hooks/useReveal";
import { SAMPLE_POSTS as S } from "@/lib/samplePosts";

const FORMATS = [
  { key: "auto", label: "Automatique" },
  { key: "A", label: "Analyse" },
  { key: "B", label: "Data" },
  { key: "C", label: "Graphique" },
  { key: "carousel", label: "Carrousel" },
];

const SOURCES = ["ACPR", "EIOPA", "DREES", "France Assureurs", "Banque de France", "INSEE", "OCDE",
  "Cour des comptes", "Commission européenne", "IFRS Foundation"];

const FAQ = [
  ["Comment les chiffres sont-ils vérifiés ?", "Chaque nombre et chaque date du texte, du visuel et du graphique est comparé au texte de la source. Ce qui n'y figure pas est signalé dans le Studio, et la programmation demande une confirmation."],
  ["Les concurrents apparaissent-ils dans la veille ?", "Non. Les actualités qui citent un cabinet de la liste des concurrents, ou qui portent sur une seule entreprise, sont écartées avant même l'analyse. La liste se modifie dans « Préciser la recherche »."],
  ["Le post est-il publié directement sur LinkedIn ?", "Pas encore. La programmation enregistre la date dans le calendrier ; la publication se fait depuis LinkedIn, avec le visuel PNG ou le carrousel PDF téléchargés depuis le Studio."],
  ["Peut-on changer le modèle du visuel ?", "Oui. Dans le Studio, « Personnaliser le modèle » change en direct les couleurs, le bandeau, les puces, la police, la date et la signature, et peut l'enregistrer comme modèle maison pour toute l'équipe."],
];

// Apply the format chosen on the home page to a generated post.
function withFormat(visual = {}, fmt) {
  if (fmt === "A" || fmt === "B") return { ...visual, recommended_format: fmt };
  if (fmt === "C") {
    if ((visual.chart?.items || []).length >= 2) return { ...visual, recommended_format: "C" };
    toast.info("Pas assez de chiffres comparables pour un graphique : format choisi automatiquement.");
    return visual;
  }
  if (fmt === "carousel") return { ...visual, open_carousel: true };
  return visual;
}

const Lines = ({ text, accent, stagger = 90, className = "", as: Tag = "h2" }) => {
  // line-by-line slide-up (word clips sharing a delay per word index; reads as a line reveal)
  const words = text.split(" ");
  return (
    <Tag className={`line-reveal ${className}`}>
      {words.map((w, i) => (
        <React.Fragment key={i}>
          <span><span style={{ "--d": `${i * (stagger / 3)}ms` }} className={w.replace(/[.,]/g, "") === accent ? "italic text-forsides-red" : ""}>{w}</span></span>{" "}
        </React.Fragment>
      ))}
    </Tag>
  );
};

const Reveal = ({ as: Tag = "div", delay = 0, className = "", children, ...rest }) => {
  const ref = useReveal(delay);
  return <Tag ref={ref} className={className} {...rest}>{children}</Tag>;
};

const SecHead = ({ eyebrow, title, accent, intro, dark = false }) => (
  <div className="grid items-end gap-6 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
    <div>
      <p className={`eyebrow ${dark ? "eyebrow-dark" : ""}`}>{eyebrow}</p>
      <Lines text={title} accent={accent} className={`mt-5 max-w-[22ch] font-serif text-4xl font-normal leading-[1.12] tracking-tight sm:text-5xl ${dark ? "text-white" : "text-forsides-ink"}`} />
    </div>
    {intro && <Reveal as="p" className={`max-w-[46ch] pb-1 leading-relaxed ${dark ? "text-white/60" : "text-forsides-slate"}`}>{intro}</Reveal>}
  </div>
);

const Home = () => {
  const nav = useNavigate();
  const { setPost, setCompose } = useStudio();
  const [tone] = useTone();
  const [mode, setMode] = useState("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [fmt, setFmt] = useState("auto");
  const [loading, setLoading] = useState(null); // "analyze" | "compose"
  const [phase, setPhase] = useState(undefined);
  const [openFaq, setOpenFaq] = useState({});
  const formRef = useRef(null);

  const focusForm = (format) => {
    if (format) setFmt(format);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => formRef.current?.querySelector(mode === "text" ? "textarea" : "input")?.focus(), 450);
  };

  const submit = async (e) => {
    e.preventDefault();
    setPhase(undefined);
    if (mode === "link") {
      const u = url.trim();
      if (!/^https?:\/\/\S+\.\S+/i.test(u)) { toast.error("Collez une adresse complète qui commence par https://"); return; }
      setLoading("analyze");
      try {
        const data = await analyzeUrl(u, "standard", { tone, onProgress: setPhase });
        setPost({ ...data, visual: withFormat(data.visual, fmt) });
        nav("/studio");
      } catch (err) {
        toast.error(err.detail || err.response?.data?.detail || "Échec de l'analyse du lien");
      } finally {
        setLoading(null);
      }
    } else {
      const t = text.trim();
      if (t.length < 30) { toast.error("Collez d'abord votre texte LinkedIn (quelques phrases)"); return; }
      setLoading("compose");
      try {
        const data = await composeFromText(t, { onProgress: setPhase });
        const post = {
          meta: { ...(data.meta || {}) },
          editorial: data.editorial || {},
          visual: withFormat(data.visual || {}, fmt),
          caption: t,
          source_text: t,
          _lastAuto: data.visual?.title_short || "",
        };
        setCompose({ text: t, post });
        nav("/compose");
        toast.success("Texte mis en forme par l'IA");
      } catch (err) {
        toast.error(err.detail || err.response?.data?.detail || "Échec de la mise en forme");
      } finally {
        setLoading(null);
      }
    }
  };

  const tab = (key, label) => (
    <button type="button" role="tab" aria-selected={mode === key} onClick={() => setMode(key)}
      data-testid={`home-tab-${key}`}
      className={`-mb-px border-b-2 px-4 pb-2.5 pt-2 text-xs uppercase tracking-[0.14em] transition-colors ${
        mode === key ? "border-forsides-red text-forsides-ink" : "border-transparent text-slate-500 hover:text-forsides-ink"}`}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-forsides-cream">
      <BrandHeader />
      {loading && <LoadingWorkflow mode={loading} phase={phase} />}

      {/* Hero: the job of the site, first */}
      <section className="px-6 pb-16 pt-12 lg:px-12 lg:pb-20 lg:pt-16">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="min-w-0 lg:col-span-7">
            <p className="eyebrow">Studio éditorial · FORSIDES</p>
            <Lines as="h1" text="De la veille à la publication LinkedIn." accent="publication" stagger={140}
              className="mt-6 max-w-[14ch] font-serif text-5xl font-normal leading-[1.04] tracking-tight text-forsides-ink sm:text-6xl lg:text-7xl" />
            <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-forsides-slate">
              Une chaîne éditoriale qui sélectionne les meilleurs sujets de l'assurance et de l'actuariat,
              trouve l'angle juste et produit un post complet, texte et visuel, fidèle à l'identité FORSIDES.
            </p>

            <form ref={formRef} onSubmit={submit} data-testid="home-convert"
              className="mt-8 max-w-2xl border border-dashed border-slate-400/60 bg-white p-5">
              <div role="tablist" aria-label="Point de départ" className="mb-4 flex border-b border-slate-200">
                {tab("link", "Un lien")}
                {tab("text", "Un texte")}
              </div>
              {mode === "link" ? (
                <>
                  <label htmlFor="home-url" className="text-xs uppercase tracking-[0.18em] text-slate-500">Collez le lien d'une actualité</label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <input id="home-url" data-testid="home-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://www.acpr.banque-france.fr/…" autoComplete="off"
                      className="min-w-0 flex-[1_1_16rem] border-0 border-b border-slate-400 bg-transparent py-3 text-base text-forsides-ink outline-none focus:border-forsides-red" />
                    <button type="submit" disabled={Boolean(loading)} data-testid="home-submit-link" className="cta-ed shrink-0 bg-forsides-red text-white hover:bg-forsides-bordeaux">
                      Transformer en post <span className="arr">→</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label htmlFor="home-text" className="text-xs uppercase tracking-[0.18em] text-slate-500">Collez votre texte LinkedIn</label>
                  <textarea id="home-text" data-testid="home-text" value={text} onChange={(e) => setText(e.target.value)} rows={6}
                    placeholder="L'IA en tire le titre, les points clés et les chiffres du visuel, sans rien inventer."
                    className="mt-2 block w-full resize-y border border-slate-200 bg-forsides-cream/60 p-3 text-[15px] leading-relaxed text-forsides-ink outline-none focus:border-forsides-red" />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">{text.length} caractère{text.length > 1 ? "s" : ""}</span>
                    <button type="submit" disabled={Boolean(loading)} data-testid="home-submit-text" className="cta-ed bg-forsides-red text-white hover:bg-forsides-bordeaux">
                      Mettre en forme <span className="arr">→</span>
                    </button>
                  </div>
                </>
              )}
              <div role="radiogroup" aria-label="Format du visuel" className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs uppercase tracking-[0.16em] text-slate-400">Format</span>
                {FORMATS.map((f) => (
                  <button key={f.key} type="button" role="radio" aria-checked={fmt === f.key} onClick={() => setFmt(f.key)}
                    data-testid={`home-format-${f.key}`}
                    className={`border border-dashed px-3 py-1.5 text-[13px] transition-colors ${
                      fmt === f.key ? "border-forsides-ink bg-forsides-ink text-white" : "border-slate-300 text-forsides-ink hover:border-forsides-ink"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </form>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/research" className="cta-ed border border-dashed border-slate-400/70 text-forsides-ink hover:bg-forsides-ink hover:text-white">
                Ou lancer une veille <span className="arr">→</span>
              </Link>
            </div>

            <dl className="mt-10 hidden grid-cols-3 gap-6 border-t border-slate-300/60 pt-7 lg:grid">
              {[["Score éditorial", "sur 100, 7 critères"], ["Sélection", "5 à 6 sujets triés"], ["Visuel", "4:5 · 1200 × 1500"]].map(([t, d]) => (
                <div key={t}><dt className="text-xs uppercase tracking-[0.18em] text-slate-400">{t}</dt><dd className="mt-1 text-sm text-forsides-ink">{d}</dd></div>
              ))}
            </dl>
          </div>
          <div className="lg:col-span-5">
            <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">Exemple de visuel généré</p>
            <VisualCanvas post={S.hero.post} version={S.hero.version} />
          </div>
        </div>
      </section>

      {/* Method */}
      <section className="rule-dashed bg-white px-6 py-16 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="eyebrow">La méthode</p>
          <Reveal as="p" className="mt-8 font-serif text-3xl leading-[1.3] text-forsides-ink sm:text-4xl lg:text-[2.75rem] lg:leading-[1.25]">
            Chaque publication doit donner l'impression qu'un professionnel de la veille a travaillé dessus.
            La recherche, le tri, l'angle et le contrôle des chiffres viennent avant la mise en forme.
          </Reveal>
          <p className="mt-8 font-serif text-xl italic text-forsides-slate">— FORSIDES, actuariat conseil</p>
        </div>
      </section>

      {/* Three ways in */}
      <section className="rule-dashed px-6 py-16 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <SecHead eyebrow="Trois façons de commencer" title="Un sujet, trois chemins vers le post." accent="trois"
            intro="Partez d'un lien, d'une veille ou de votre propre texte. Les trois chemins mènent au même Studio : score, texte LinkedIn, vérification des chiffres et visuel au format choisi." />
          <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              { n: "Mode 1", t: "Analyser un lien", d: "L'article est lu en entier, scoré sur 100, puis transformé en post.", s: S.acpr, onClick: () => { setMode("link"); focusForm(); } },
              { n: "Mode 2", t: "Lancer une veille", d: "Google News sans les entreprises ni les concurrents, dédupliqué et noté. Les sujets déjà traités passent en bas.", s: S.cotis, to: "/research" },
              { n: "Mode 3", t: "Partir d'un texte", d: "Votre texte est déjà écrit : l'IA en tire le titre, les points et les chiffres du visuel.", s: S.drees, onClick: () => { setMode("text"); focusForm(); } },
            ].map((m, i) => (
              <Reveal as="figure" key={m.t} delay={i * 90}>
                <VisualCanvas post={m.s.post} version={m.s.version} />
                <figcaption className="rule-dashed mt-6 pt-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-forsides-red">{m.n}</p>
                  <h3 className="mt-1.5 text-xl font-medium text-forsides-ink">{m.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-forsides-slate">{m.d}</p>
                  {m.to ? (
                    <Link to={m.to} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-forsides-red hover:text-forsides-bordeaux">Commencer →</Link>
                  ) : (
                    <button type="button" onClick={m.onClick} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-forsides-red hover:text-forsides-bordeaux">Commencer →</button>
                  )}
                </figcaption>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Dark band: veille */}
      <section className="bg-forsides-ink px-6 py-16 text-white lg:px-12 lg:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="max-w-xl lg:col-span-6">
            <p className="eyebrow eyebrow-dark">Veille</p>
            <Lines text="Certains sujets n'attendent pas." className="mt-6 font-serif text-4xl font-normal leading-[1.12] sm:text-5xl lg:text-6xl" />
            <p className="mt-7 text-lg leading-relaxed text-white/60">
              Une échéance ACPR, un rapport DREES, un acte délégué de l'EIOPA : la veille repère, score et trie
              les sujets du jour, sans les actualités d'entreprises ni de concurrents.
            </p>
            <Link to="/research" className="cta-ed mt-9 bg-white text-forsides-ink hover:bg-[#F7E8E4]">Lancer une veille <span className="arr">→</span></Link>
          </div>
          <Reveal className="lg:col-span-5 lg:col-start-8"><VisualCanvas post={S.solva.post} version={S.solva.version} /></Reveal>
        </div>
      </section>

      {/* Rules */}
      <section className="bg-[#F7E8E4] px-6 py-16 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <SecHead eyebrow="Règles de la rédaction" title="Trois règles que le studio applique à chaque post."
            intro="Elles sont appliquées automatiquement, de la recherche à la programmation, pour que chaque post engage la crédibilité de FORSIDES sans risque." />
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {[
              ["Aucun chiffre inventé.", "Chaque nombre et chaque date du texte, du visuel et du graphique est comparé à la source avant publication."],
              ["Le marché, pas les entreprises.", "Les actualités centrées sur une société ou un cabinet concurrent sont écartées dès la recherche."],
              ["Le style maison d'abord.", "Ton, formules à éviter, signature et hashtags sont réglés une fois et appliqués à tous les textes."],
            ].map(([t, d], i) => (
              <Reveal as="article" key={t} delay={i * 90} className="border-t-2 border-forsides-red bg-white/70 p-7">
                <p className="font-serif text-2xl text-forsides-red">0{i + 1}</p>
                <h3 className="mt-4 text-xl font-medium leading-snug text-forsides-ink">{t}</h3>
                <p className="mt-3 leading-relaxed text-forsides-slate">{d}</p>
              </Reveal>
            ))}
          </div>
          <Link to="/settings" className="mt-8 inline-flex text-sm font-semibold text-forsides-red hover:text-forsides-bordeaux">Régler le style maison →</Link>
        </div>
      </section>

      {/* Process */}
      <section className="rule-dashed px-6 py-16 lg:px-12 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5"><div className="lg:sticky lg:top-28">
            <p className="eyebrow">La chaîne éditoriale</p>
            <Lines text="De la source au post publié." className="mt-5 max-w-[18ch] font-serif text-4xl font-normal leading-[1.12] text-forsides-ink sm:text-5xl" />
          </div></div>
          <ol className="lg:col-span-7">
            {[
              ["Rechercher", "Google News et les sources institutionnelles, filtrés des concurrents, dédupliqués, avec l'article complet lu pour chaque sujet retenu."],
              ["Scorer", "Pertinence, impact, actualité, fiabilité, potentiel LinkedIn, clarté et originalité : un score sur 100 et une catégorie."],
              ["Rédiger", "L'angle le plus fort, un texte dans le ton choisi, sans markdown ni formule creuse, relu et nettoyé automatiquement."],
              ["Vérifier et mettre en forme", "Contrôle des chiffres, visuel 4:5 en trois formats, carrousel PDF, version anglaise et programmation dans le calendrier."],
            ].map(([t, d], i) => (
              <Reveal as="li" key={t} className="rule-dashed flex flex-col gap-3 py-7 sm:flex-row sm:gap-10">
                <span className="min-w-[5rem] font-serif text-6xl leading-none text-slate-300">0{i + 1}</span>
                <div className="sm:pt-2">
                  <h3 className="text-2xl font-medium text-forsides-ink">{t}</h3>
                  <p className="mt-3 max-w-[48ch] text-lg leading-relaxed text-forsides-slate">{d}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Formats */}
      <section className="rule-dashed bg-white px-6 py-16 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <SecHead eyebrow="Formats" title="Un post, quatre façons de le montrer."
            intro="Choisissez le format avant de générer, ou laissez l'IA choisir. Chaque visuel suit le modèle maison, modifiable en direct dans le Studio." />
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { k: "A", t: "Analyse", d: "L'essentiel et trois points de décryptage", s: S.hero },
              { k: "B", t: "Data", d: "Chiffre clé, échéance et les chiffres", s: S.drees },
              { k: "C", t: "Graphique", d: "Barres ou camembert, à partir des chiffres de la source", s: S.cotis },
              { k: "carousel", t: "Carrousel", d: "4 à 6 pages en PDF pour LinkedIn", s: S.hero, page: 0 },
            ].map((f, i) => (
              <Reveal as="article" key={f.k} delay={(i % 2) * 90}>
                <button type="button" onClick={() => focusForm(f.k)} className="group block w-full text-left" aria-label={`Choisir le format ${f.t}`}>
                  <div className="transition-transform duration-500 group-hover:-translate-y-2">
                    <VisualCanvas post={f.s.post} version={f.k === "carousel" ? "A" : f.k} page={f.page ?? null} label={`Format ${f.t}`} />
                  </div>
                  <div className="rule-dashed mt-5 flex items-start justify-between gap-4 pt-4">
                    <div><h3 className="text-lg font-medium text-forsides-ink">{f.t}</h3><p className="mt-1 text-sm text-forsides-slate">{f.d}</p></div>
                    <span className="whitespace-nowrap text-sm font-semibold text-forsides-red opacity-0 transition-opacity group-hover:opacity-100">Choisir →</span>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Sources */}
      <section className="bg-[#F7E8E4] px-6 py-16 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <SecHead eyebrow="Sources suivies" title="Les institutions qui font l'actualité."
            intro="Leur logo officiel est ajouté automatiquement au visuel quand elles sont la source du post. Vous pouvez aussi importer le logo de n'importe quelle autre source." />
          <ul className="mt-10 grid sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
            {SOURCES.map((v, i) => (
              <li key={v} className="rule-dashed flex items-baseline gap-5 py-5">
                <span className="font-serif text-sm tabular-nums text-slate-500">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-serif text-xl text-forsides-ink lg:text-2xl">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="rule-dashed px-6 py-16 lg:px-12 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <p className="eyebrow">Questions</p>
            <Lines text="Avant de publier." className="mt-5 font-serif text-4xl font-normal text-forsides-ink sm:text-5xl" />
          </div>
          <div className="lg:col-span-8">
            {FAQ.map(([q, a], i) => (
              <div key={q} className="rule-dashed">
                <h3>
                  <button type="button" aria-expanded={Boolean(openFaq[i])} aria-controls={`faq-${i}`} id={`faq-q-${i}`}
                    onClick={() => setOpenFaq((o) => ({ ...o, [i]: !o[i] }))}
                    className="flex w-full items-center justify-between gap-8 py-6 text-left">
                    <span className="text-xl font-medium text-forsides-ink lg:text-2xl">{q}</span>
                    <span className={`text-2xl text-forsides-ink transition-transform duration-500 ${openFaq[i] ? "rotate-45" : ""}`} aria-hidden="true">+</span>
                  </button>
                </h3>
                <div id={`faq-${i}`} role="region" aria-labelledby={`faq-q-${i}`}
                  className={`grid transition-all duration-500 ${openFaq[i] ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                  <p className="overflow-hidden pb-0 text-lg leading-relaxed text-forsides-slate">
                    <span className="block max-w-[60ch] pb-8">{a}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default Home;
