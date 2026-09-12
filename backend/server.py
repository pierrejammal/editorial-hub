import os
import re
import json
import uuid
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone

import requests
import feedparser
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from urllib.parse import urlparse

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("forsides")

FR_MONTHS = ["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET",
             "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"]

EDITORIAL_SYSTEM = (
    "Tu es le rédacteur en chef d'une cellule de veille éditoriale spécialisée dans "
    "l'assurance, l'actuariat, la santé, la prévoyance, la protection sociale, Solvabilité II, "
    "l'assurance vie, la retraite, la réassurance, la finance et le risque, et la réglementation "
    "(EIOPA, ACPR, DREES, Direction de la Sécurité sociale, ministères, Commission européenne, "
    "INSEE, OCDE, France Assureurs). Tu travailles pour FORSIDES, cabinet d'actuariat conseil. "
    "Tu es rigoureux, tu n'inventes jamais de chiffres, de dates, de citations ni de conclusions "
    "réglementaires. Si une information est incertaine, tu le signales. Tu réponds STRICTEMENT en "
    "JSON valide, sans texte autour, sans balise markdown."
)


def french_date_label(dt: Optional[datetime]) -> str:
    d = dt or datetime.now(timezone.utc)
    return f"{FR_MONTHS[d.month - 1]} {d.year}"


def parse_json(raw: str) -> Dict[str, Any]:
    if not raw:
        raise ValueError("empty LLM response")
    txt = raw.strip()
    txt = re.sub(r"^```(?:json)?", "", txt).strip()
    txt = re.sub(r"```$", "", txt).strip()
    start = txt.find("{")
    end = txt.rfind("}")
    if start != -1 and end != -1:
        txt = txt[start:end + 1]
    return json.loads(txt)


async def llm_text(system: str, prompt: str) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-6")
    resp = await chat.send_message(UserMessage(text=prompt))
    return resp if isinstance(resp, str) else str(resp)


async def llm_json(system: str, prompt: str) -> Dict[str, Any]:
    raw = await llm_text(system, prompt)
    try:
        return parse_json(raw)
    except Exception as e:
        logger.error(f"JSON parse failed: {e} | raw head: {raw[:200]}")
        raise HTTPException(status_code=502, detail="Réponse IA illisible, réessayez.")


def scrape_url(url: str) -> Dict[str, Any]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Referer": "https://www.google.com/",
    }
    html = None
    try:
        r = requests.get(url, headers=headers, timeout=12)
        if r.status_code == 200:
            html = r.text
    except Exception:
        html = None

    domain = urlparse(url).netloc.replace("www.", "")
    title = site_name = pub = image = None
    text = ""

    if html:
        soup = BeautifulSoup(html, "lxml")

        def meta(*names):
            for n in names:
                tag = soup.find("meta", attrs={"property": n}) or soup.find("meta", attrs={"name": n})
                if tag and tag.get("content"):
                    return tag["content"].strip()
            return None

        title = meta("og:title", "twitter:title") or (soup.title.string.strip() if soup.title and soup.title.string else "")
        site_name = meta("og:site_name")
        image = meta("og:image", "twitter:image")
        pub = meta("article:published_time", "og:published_time", "datePublished", "publication_date")
        if not pub:
            t = soup.find("time")
            if t and t.get("datetime"):
                pub = t["datetime"]
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "noscript"]):
            tag.decompose()
        paras = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
        text = "\n".join([p for p in paras if len(p) > 40])[:4000]

    # Fallback: readable proxy (handles bot-blocked / JS-heavy sites)
    if not text or len(text) < 150:
        try:
            jr = requests.get(f"https://r.jina.ai/{url}", timeout=18,
                              headers={"User-Agent": headers["User-Agent"]})
            if jr.status_code == 200 and len(jr.text) > 150:
                text = jr.text[:4000]
                if not title:
                    m = re.search(r"Title:\s*(.+)", jr.text)
                    if m:
                        title = m.group(1).strip()
        except Exception:
            pass

    if not text or len(text) < 120:
        raise HTTPException(status_code=422,
                            detail="Cette source bloque l'accès automatisé ou son contenu est insuffisant. Essayez un autre lien.")

    return {"title": title or "", "site_name": site_name or domain, "domain": domain,
            "published": pub, "image": image, "text": text}


# ---------- Models ----------
class AnalyzeUrlReq(BaseModel):
    url: str
    length: str = "standard"


class SearchReq(BaseModel):
    topic: str
    period: str = "3 dernières semaines"
    country: str = "France / Europe"
    institutions: str = ""
    max_results: int = 6
    exclude: List[str] = Field(default_factory=list)


class AnalyzeTopicReq(BaseModel):
    topic: Dict[str, Any]
    length: str = "standard"


class ComposeReq(BaseModel):
    caption: str


class CaptionReq(BaseModel):
    context: Dict[str, Any]
    length: str = "standard"
    action: str = "generate"
    angle: Optional[str] = None
    current_caption: Optional[str] = None


class QualityReq(BaseModel):
    caption: str
    context: Dict[str, Any]


class VisualReq(BaseModel):
    title: str
    sector: str = ""
    topic: str = ""
    angle: str = ""


CAPTION_SYSTEM = (
    "Tu es le rédacteur en chef d'une cellule de veille éditoriale FORSIDES spécialisée dans "
    "l'assurance, l'actuariat, la protection sociale et la réglementation (EIOPA, ACPR, DREES, "
    "France Assureurs, Solvabilité II, IFRS 17). Tu écris des posts LinkedIn professionnels, humains "
    "et éditoriaux. Tu n'inventes jamais de chiffres, dates ou citations. Tu réponds UNIQUEMENT avec "
    "le texte du caption demandé, en clair, sans JSON, sans balises markdown, sans guillemets autour."
)

LENGTH_GUIDE = {
    "court": "Court et percutant, 500 à 800 caractères.",
    "standard": "Standard, 1000 à 1500 caractères.",
    "analytique": "Analytique et argumenté, 1500 à 1800 caractères.",
    "decryptage": "Décryptage approfondi, 1800 à 2200 caractères, plus de contexte technique.",
}

CAPTION_RULES = (
    "STYLE: professionnel, naturel, humain, précis, intelligent, fluide, éditorial, accessible. "
    "Le texte ne doit JAMAIS sembler écrit par une IA. "
    "INTERDICTIONS ABSOLUES: « Dans un monde en constante évolution », "
    "« Cette actualité marque un tournant majeur », « Il est important de noter que », "
    "« Une chose est certaine », « Qu'en pensez-vous ? », « Un sujet à suivre de près », "
    "« Grande nouvelle », emojis en excès, hashtags en excès, listes de banalités, conclusions artificielles. "
    "Maximum 2 ou 3 hashtags pertinents et optionnels. "
    "STRUCTURE: 1) accroche forte, 2) contexte bref, 3) décryptage à valeur ajoutée (pas un simple résumé), "
    "4) pourquoi cela compte (assureurs/actuaires/institutions/marché) si pertinent, 5) conclusion naturelle. "
    "Ne jamais inventer de chiffres, dates ou citations."
)


def ANALYSIS_INSTRUCTIONS(length: str) -> str:
    return f"""Analyse ce sujet et renvoie un objet JSON avec EXACTEMENT cette structure:
{{
  "meta": {{ "topic": "sujet principal court", "sector": "secteur concerné" }},
  "extracted": {{ "figures": [], "regulatory_changes": [], "consequences": [], "recency_note": "" }},
  "scoring": {{
    "pertinence": {{"score": int 0-20}}, "impact": {{"score": int 0-20}}, "actualite": {{"score": int 0-15}},
    "fiabilite": {{"score": int 0-15}}, "linkedin": {{"score": int 0-15}}, "vulgarisation": {{"score": int 0-10}},
    "originalite": {{"score": int 0-5}}, "total": int 0-100,
    "classification": "PRIORITÉ ÉDITORIALE | TRÈS FORT | BON SUJET | SUJET MOYEN | À ÉCARTER",
    "strengths": ["3 à 5"], "weaknesses": ["1 à 3"], "vigilance": "", "recommendation": ""
  }},
  "editorial": {{
    "fact": "", "what_changes": "", "why_important": "", "insight": "", "key_figure": "",
    "angle": "angle éditorial retenu",
    "angle_options": ["Alerte réglementaire","Ce qui change","Le chiffre à retenir","Décryptage","Ce qu'il faut comprendre","Ce que cela implique","Une tendance à surveiller","Un point de vigilance","Une opportunité","Analyse technique simplifiée"]
  }},
  "visual": {{
    "recommended_format": "A ou B",
    "title_short": "titre éditorial reformulé 10-18 mots, ne pas copier le titre original",
    "subtitle": "", "key_figure_value": "", "key_figure_label": "",
    "important_date": "date importante ou échéance ou ''",
    "data_points": ["3 à 4 informations clés très courtes"],
    "insight_line": "phrase insight finale très courte pour le visuel"
  }},
  "caption": "caption LinkedIn complet prêt à publier",
  "quality": {{ "score": int 0-100, "criteria": {{"veracite": int, "nouveaute": int, "interet": int, "clarte": int, "originalite": int, "style": int}}, "suggestions": [] }},
  "sources": [{{"title": "", "url": ""}}]
}}
Choisis l'angle le PLUS pertinent (ne pas toujours le même). recommended_format='B' si le sujet repose sur un chiffre fort / plusieurs dates / comparaison, sinon 'A'.
Caption: {LENGTH_GUIDE.get(length, LENGTH_GUIDE['standard'])} {CAPTION_RULES}
Le score doit être exigeant et justifié."""


# ---------- Core logic ----------
async def do_analyze_url(req: AnalyzeUrlReq) -> Dict[str, Any]:
    scraped = scrape_url(req.url)
    pub_dt = None
    if scraped["published"]:
        try:
            pub_dt = datetime.fromisoformat(scraped["published"].replace("Z", "+00:00"))
        except Exception:
            pub_dt = None
    prompt = f"""SOURCE URL: {req.url}
NOM DE LA SOURCE: {scraped['site_name']}
DATE DÉTECTÉE: {scraped['published'] or 'inconnue'}
TITRE ORIGINAL: {scraped['title']}
CONTENU:
{scraped['text']}

{ANALYSIS_INSTRUCTIONS(req.length)}"""
    data = await llm_json(EDITORIAL_SYSTEM, prompt)
    data["meta"] = data.get("meta", {})
    data["meta"].update({
        "source": scraped["site_name"],
        "source_url": req.url,
        "publication_date": scraped["published"] or "",
        "date_label": french_date_label(pub_dt),
        "image_url": scraped.get("image") or "",
    })
    if not data.get("sources"):
        data["sources"] = [{"title": scraped["site_name"], "url": req.url}]
    data["id"] = str(uuid.uuid4())
    await db.posts.insert_one({**data, "created_at": datetime.now(timezone.utc).isoformat()})
    data.pop("_id", None)
    return data


async def do_search(req: SearchReq) -> Dict[str, Any]:
    q = req.topic
    if req.institutions:
        q = f"{q} {req.institutions}"
    rss = f"https://news.google.com/rss/search?q={requests.utils.quote(q)}&hl=fr&gl=FR&ceid=FR:fr"
    feed = feedparser.parse(rss)
    candidates = []
    for entry in feed.entries[:14]:
        src = entry.source.title if entry.get("source") and entry.source.get("title") else ""
        summary = re.sub("<[^<]+?>", "", entry.get("summary", ""))[:280]
        candidates.append({
            "title": entry.get("title", ""),
            "source": src,
            "date": entry.get("published", ""),
            "link": entry.get("link", ""),
            "snippet": summary,
        })
    if not candidates:
        raise HTTPException(status_code=404, detail="Aucune source trouvée pour ce sujet. Reformulez la recherche.")

    exclude_txt = "; ".join(req.exclude) if req.exclude else "(aucun)"
    n = min(max(req.max_results, 3), 6)
    prompt = f"""Sujet: "{req.topic}". Période: {req.period}. Zone: {req.country}.
SOURCES CANDIDATES (JSON): {json.dumps(candidates, ensure_ascii=False)}
SUJETS DÉJÀ PROPOSÉS À EXCLURE: {exclude_txt}

Applique: DÉDUPLICATION (regroupe le même événement, garde la source primaire), FILTRAGE (élimine anciens/promotionnels/vagues/doublons/peu fiables), SCORING /100, puis TRIAGE des {n} meilleurs sujets (exclure ceux déjà proposés).
Renvoie STRICTEMENT ce JSON:
{{"candidates_count": {len(candidates)}, "topics": [
  {{"title": "titre éditorial reformulé court", "source": "source primaire", "source_url": "lien fiable",
    "date": "date lisible", "summary": "résumé 2 phrases", "why_attention": "", "main_insight": "", "sector": "",
    "priority": "PRIORITÉ ÉDITORIALE | TRÈS FORT | BON SUJET", "score": int 0-100,
    "scoring": {{"pertinence": {{"score": int}}, "impact": {{"score": int}}, "actualite": {{"score": int}}, "fiabilite": {{"score": int}}, "linkedin": {{"score": int}}, "vulgarisation": {{"score": int}}, "originalite": {{"score": int}}, "total": int}}
  }}
]}}
N'invente rien: appuie-toi sur les titres/sources/snippets fournis."""
    data = await llm_json(EDITORIAL_SYSTEM, prompt)
    topics = data.get("topics", [])
    topics.sort(key=lambda t: t.get("score", 0), reverse=True)
    for t in topics:
        t["id"] = str(uuid.uuid4())
        t.setdefault("date_label", french_date_label(None))
    data["topics"] = topics
    return data


async def do_analyze_topic(req: AnalyzeTopicReq) -> Dict[str, Any]:
    t = req.topic
    prompt = f"""Sujet sélectionné pour production éditoriale FORSIDES:
TITRE: {t.get('title')}
SOURCE: {t.get('source')}
LIEN: {t.get('source_url', '')}
DATE: {t.get('date', '')}
RÉSUMÉ: {t.get('summary', '')}
POURQUOI: {t.get('why_attention', '')}
INSIGHT: {t.get('main_insight', '')}
SECTEUR: {t.get('sector', '')}

{ANALYSIS_INSTRUCTIONS(req.length)}
Le bloc scoring reprend/affine le scoring déjà établi (score global {t.get('score')})."""
    data = await llm_json(EDITORIAL_SYSTEM, prompt)
    data["meta"] = data.get("meta", {})
    data["meta"].update({
        "source": t.get("source", ""),
        "source_url": t.get("source_url", ""),
        "publication_date": t.get("date", ""),
        "date_label": t.get("date_label") or french_date_label(None),
        "image_url": "",
    })
    if not data.get("sources"):
        data["sources"] = [{"title": t.get("source", ""), "url": t.get("source_url", "")}]
    data["id"] = str(uuid.uuid4())
    await db.posts.insert_one({**data, "created_at": datetime.now(timezone.utc).isoformat()})
    data.pop("_id", None)
    return data


async def do_compose(req: ComposeReq) -> Dict[str, Any]:
    prompt = f"""Voici un texte destiné à un post LinkedIn (rédigé par l'utilisateur):
\"\"\"{req.caption}\"\"\"

À partir de CE TEXTE uniquement (ne rien inventer), prépare les éléments du visuel LinkedIn FORSIDES.
Renvoie STRICTEMENT ce JSON:
{{
  "meta": {{ "topic": "sujet en quelques mots", "sector": "secteur" }},
  "editorial": {{ "insight": "phrase insight tirée du texte ou ''", "angle": "angle dominant du texte" }},
  "visual": {{
    "recommended_format": "A ou B",
    "title_short": "titre éditorial court et fort tiré du texte (10-16 mots), reformulé, sans guillemets",
    "key_figure_value": "chiffre clé présent dans le texte ou ''",
    "key_figure_label": "libellé court du chiffre ou ''",
    "important_date": "date/échéance présente ou ''",
    "data_points": ["2 à 4 points clés très courts tirés du texte"],
    "insight_line": "phrase finale courte pour le visuel"
  }}
}}"""
    data = await llm_json(EDITORIAL_SYSTEM, prompt)
    data["meta"] = data.get("meta", {})
    data["meta"].setdefault("date_label", french_date_label(None))
    data["meta"].setdefault("source", "")
    data["meta"]["image_url"] = ""
    data["caption"] = req.caption
    return data


# ---------- Job system (bypasses 60s edge timeout) ----------
async def run_job(job_id: str, coro):
    try:
        result = await coro
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "done", "result": result}})
    except HTTPException as e:
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "error", "detail": str(e.detail)}})
    except Exception as e:
        logger.exception("job failed")
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "error", "detail": "Erreur interne, réessayez."}})


async def start_job(coro) -> Dict[str, str]:
    job_id = str(uuid.uuid4())
    await db.jobs.insert_one({"id": job_id, "status": "pending",
                             "created_at": datetime.now(timezone.utc).isoformat()})
    asyncio.create_task(run_job(job_id, coro))
    return {"job_id": job_id}


@api_router.get("/")
async def root():
    return {"message": "FORSIDES News Studio API"}


@api_router.post("/jobs/analyze-url")
async def job_analyze_url(req: AnalyzeUrlReq):
    return await start_job(do_analyze_url(req))


@api_router.post("/jobs/search")
async def job_search(req: SearchReq):
    return await start_job(do_search(req))


@api_router.post("/jobs/analyze-topic")
async def job_analyze_topic(req: AnalyzeTopicReq):
    return await start_job(do_analyze_topic(req))


@api_router.post("/jobs/compose")
async def job_compose(req: ComposeReq):
    return await start_job(do_compose(req))


@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    doc = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Job introuvable")
    return doc


@api_router.post("/caption")
async def caption(req: CaptionReq):
    ctx = req.context
    action_map = {
        "generate": "Rédige le caption.",
        "regenerate": "Régénère un caption différent, nouvel angle rédactionnel, même sujet.",
        "shorten": "Raccourcis fortement le caption actuel (environ -35%) en gardant l'essentiel.",
        "analytical": "Réécris le caption dans un registre plus analytique et argumenté.",
        "accessible": "Réécris le caption pour le rendre plus accessible et pédagogique, sans perdre la valeur technique.",
        "change_angle": f"Réécris le caption avec un nouvel angle éditorial: {req.angle}.",
    }
    instruction = action_map.get(req.action, action_map["generate"])
    prompt = f"""Sujet:
FAIT: {ctx.get('fact', '')}
CE QUI CHANGE: {ctx.get('what_changes', '')}
POURQUOI C'EST IMPORTANT: {ctx.get('why_important', '')}
INSIGHT: {ctx.get('insight', '')}
CHIFFRE CLÉ: {ctx.get('key_figure', '')}
ANGLE: {req.angle or ctx.get('angle', '')}
SOURCE: {ctx.get('source', '')}

CAPTION ACTUEL:
{req.current_caption or '(aucun)'}

CONSIGNE: {instruction}
Longueur cible: {LENGTH_GUIDE.get(req.length, LENGTH_GUIDE['standard'])}
{CAPTION_RULES}
Renvoie UNIQUEMENT le texte du caption, sans guillemets ni commentaire."""
    text = await llm_text(CAPTION_SYSTEM, prompt)
    return {"caption": text.strip().strip('"')}


@api_router.post("/quality")
async def quality(req: QualityReq):
    ctx = req.context
    prompt = f"""Contrôle qualité éditorial du post LinkedIn suivant.
SUJET: {ctx.get('fact', '')} / {ctx.get('insight', '')}
CAPTION:
{req.caption}

Évalue 6 critères sur 100: veracite, nouveaute, interet, clarte, originalite, style (naturel, pas IA).
Renvoie STRICTEMENT:
{{"score": int 0-100, "criteria": {{"veracite": int, "nouveaute": int, "interet": int, "clarte": int, "originalite": int, "style": int}}, "suggestions": ["si < 75: comment améliorer"]}}"""
    return await llm_json(EDITORIAL_SYSTEM, prompt)


@api_router.post("/visual-image")
async def visual_image(req: VisualReq):
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message="You generate professional editorial illustration images.",
    ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    prompt = (
        f"Create a professional editorial press photograph-style illustration for a FORSIDES LinkedIn news post. "
        f"Topic: {req.topic}. Sector: {req.sector}. Angle: {req.angle}. "
        f"Realistic, high quality, corporate/institutional, relevant to the topic, natural lighting, "
        f"no text, no words, no letters, no logos, no watermark, horizontal composition."
    )
    try:
        _, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    except Exception as e:
        logger.error(f"image gen failed: {e}")
        raise HTTPException(status_code=502, detail="Échec de génération du visuel, réessayez.")
    if not images:
        raise HTTPException(status_code=502, detail="Aucune image générée.")
    img = images[0]
    return {"image": f"data:{img['mime_type']};base64,{img['data']}"}


@api_router.get("/post/{post_id}")
async def get_post(post_id: str):
    doc = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Introuvable")
    return doc


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
