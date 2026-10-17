import os
import re
import json
import base64
import uuid
import socket
import asyncio
import logging
import ipaddress
from pathlib import Path
from datetime import datetime, timezone, timedelta

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


LLM_TIMEOUT_S = 120  # a hung AI call must never leave a job "pending" forever


async def llm_text(system: str, prompt: str, model: str = "claude-sonnet-4-6") -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=system,
    ).with_model("anthropic", model)
    try:
        resp = await asyncio.wait_for(chat.send_message(UserMessage(text=prompt)), timeout=LLM_TIMEOUT_S)
    except asyncio.TimeoutError:
        logger.error("LLM call timed out")
        raise HTTPException(status_code=504, detail="L'IA met trop de temps à répondre, réessayez.")
    return resp if isinstance(resp, str) else str(resp)


FAST_MODEL = "claude-haiku-4-5-20251001"


async def llm_json(system: str, prompt: str, model: str = "claude-sonnet-4-6") -> Dict[str, Any]:
    # One automatic retry: an occasional malformed JSON answer should not fail the whole workflow.
    for attempt in range(2):
        raw = await llm_text(system, prompt, model)
        try:
            data = parse_json(raw)
            if isinstance(data, dict):
                return data
            raise ValueError("JSON root is not an object")
        except Exception as e:
            logger.error(f"JSON parse failed (attempt {attempt + 1}): {e} | raw head: {raw[:200]}")
    raise HTTPException(status_code=502, detail="Réponse IA illisible, réessayez.")


# ---------- Score consistency ----------
SCORE_MAX = {"pertinence": 20, "impact": 20, "actualite": 15, "fiabilite": 15,
             "linkedin": 15, "vulgarisation": 10, "originalite": 5}


def to_int(v: Any, default: int = 0) -> int:
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return default


def classification_for(total: int) -> str:
    # Same thresholds as frontend/src/lib/score.js (scoreBand)
    if total >= 90:
        return "PRIORITÉ ÉDITORIALE"
    if total >= 80:
        return "TRÈS FORT"
    if total >= 70:
        return "BON SUJET"
    if total >= 60:
        return "SUJET MOYEN"
    return "À ÉCARTER"


def normalize_scoring(data: Dict[str, Any]) -> None:
    """The AI sometimes returns a total that doesn't match its sub-scores, or values out of range.
    Clamp each sub-score to its max and recompute the total so the gauge and the details agree."""
    s = data.get("scoring")
    if not isinstance(s, dict):
        return
    total, found = 0, 0
    for key, mx in SCORE_MAX.items():
        item = s.get(key)
        raw = item.get("score") if isinstance(item, dict) else item
        if raw is None:
            continue
        val = max(0, min(mx, to_int(raw)))
        if isinstance(item, dict):
            item["score"] = val
        else:
            s[key] = {"score": val}
        total += val
        found += 1
    if found == len(SCORE_MAX):
        s["total"] = total
    else:
        s["total"] = max(0, min(100, to_int(s.get("total"))))
    s["classification"] = classification_for(s["total"])
    q = data.get("quality")
    if isinstance(q, dict) and "score" in q:
        q["score"] = max(0, min(100, to_int(q.get("score"))))


# ---------- Chart validation ----------
def to_number(v: Any) -> Optional[float]:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.replace(" ", "").replace("\xa0", "").replace(" ", "")
        s = re.sub(r"[^0-9,.\-]", "", s).replace(",", ".")
        if s.count(".") > 1:  # "1.234.567" → thousands separators
            s = s.replace(".", "")
        try:
            return float(s)
        except ValueError:
            return None
    return None


def normalize_chart(data: Dict[str, Any]) -> None:
    """Keep a chart only if it is really drawable: 2-6 numeric values, short labels.
    A 'pie' whose parts don't form a whole becomes a bar chart (a pie of unrelated numbers is misleading).
    When a valid chart exists, the visual defaults to the 'C' (Graphique) format."""
    v = data.get("visual")
    if not isinstance(v, dict):
        return
    c = v.get("chart")
    items = []
    if isinstance(c, dict) and c.get("type") in ("bar", "pie"):
        for it in c.get("items") or []:
            if not isinstance(it, dict):
                continue
            label = str(it.get("label") or "").strip()[:40]
            val = to_number(it.get("value"))
            if label and val is not None:
                items.append({"label": label, "value": val})
    if len(items) < 2:
        v["chart"] = None
        return
    items = items[:6]
    ctype = c["type"]
    if ctype == "pie":
        total = sum(i["value"] for i in items)
        unit = str(c.get("unit") or "").strip()
        if any(i["value"] < 0 for i in items) or total <= 0 or (unit == "%" and not 90 <= total <= 110):
            ctype = "bar"
    v["chart"] = {
        "type": ctype,
        "title": str(c.get("title") or "").strip()[:90],
        "unit": str(c.get("unit") or "").strip()[:12],
        "items": items,
        "note": str(c.get("note") or "").strip()[:160],
    }
    v["recommended_format"] = "C"


# ---------- Caption cleanup ----------
HASHTAG_RE = re.compile(r"(?<!\w)#[\wÀ-ÿ]+")


def clean_caption(text: str, lang: str = "fr") -> str:
    """Deterministic clean-up of the LinkedIn text: LinkedIn shows markdown symbols literally,
    and AI output sometimes has doubled spaces, stray quotes, repeated paragraphs or 6 hashtags."""
    if not text:
        return ""
    t = text.replace("\r\n", "\n").strip()
    t = t.strip('"“”«» \n')
    t = re.sub(r"^(caption|texte|post)\s*:\s*", "", t, flags=re.I)
    t = re.sub(r"\*\*(.+?)\*\*", r"\1", t)            # **gras** → gras
    t = re.sub(r"(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)", r"\1", t)  # *italique*
    t = re.sub(r"^#{1,6}\s+", "", t, flags=re.M)        # ## Titre → Titre
    t = re.sub(r"^\s*[-*•]\s+", "→ ", t, flags=re.M)   # markdown bullets → LinkedIn-friendly arrows
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r" +([,.])", r"\1", t)                  # "mot ." → "mot."
    if lang == "en":
        t = re.sub(r"(?<=\w) +([;:!?])", r"\1", t)  # English: no space before ; : ! ?
    else:
        t = re.sub(r"(?<=\w)([;:!?])(?=\s|$)", r" \1", t, flags=re.M)  # French: "mot :" (not 14:30, not URLs)
    t = re.sub(r"\n{3,}", "\n\n", t)
    t = "\n".join(line.strip() for line in t.split("\n"))

    # drop exact duplicate paragraphs (the model sometimes repeats its conclusion)
    seen, paras = set(), []
    for p in t.split("\n\n"):
        key = re.sub(r"\W+", "", p.lower())
        if key and key in seen:
            continue
        seen.add(key)
        paras.append(p)
    t = "\n\n".join(paras)

    # hashtag-only lines: merged, de-duplicated, max 3, on one final line (inline #tags in sentences are left alone)
    lines, tags = [], []
    for line in t.split("\n"):
        if line and HASHTAG_RE.sub("", line).strip() == "":
            for tag in HASHTAG_RE.findall(line):
                if tag.lower() not in [x.lower() for x in tags]:
                    tags.append(tag)
        else:
            lines.append(line)
    t = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
    if tags:
        t += "\n\n" + " ".join(tags[:3])
    return t.strip()


# ---------- URL safety ----------
def check_public_url(url: str) -> None:
    """Refuse non-web URLs and addresses inside the server's own network (localhost, 10.x, 169.254.x...),
    so the scraper can't be used to read internal services."""
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise HTTPException(status_code=422, detail="Lien invalide : utilisez une adresse commençant par http:// ou https://")
    try:
        infos = socket.getaddrinfo(p.hostname, None)
    except socket.gaierror:
        return  # can't resolve here: let the normal fetch (and its r.jina.ai fallback) decide
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise HTTPException(status_code=422, detail="Ce lien n'est pas autorisé.")


def decode_html(r: requests.Response) -> str:
    # Pages without a declared charset are decoded as Latin-1 by requests, which breaks French accents ("Ã©").
    if not r.encoding or r.encoding.lower() == "iso-8859-1":
        r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def scrape_url(url: str) -> Dict[str, Any]:
    check_public_url(url)
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
            html = decode_html(r)
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
    tone: Optional[str] = None  # None → the house default tone


class SearchReq(BaseModel):
    topic: str
    period: str = "3 dernières semaines"
    country: str = "France / Europe"
    institutions: str = ""
    max_results: int = 6
    exclude: List[str] = Field(default_factory=list)
    competitors: Optional[List[str]] = None  # None → DEFAULT_COMPETITORS


class AnalyzeTopicReq(BaseModel):
    topic: Dict[str, Any]
    length: str = "standard"
    tone: Optional[str] = None


class ComposeReq(BaseModel):
    caption: str


class CaptionReq(BaseModel):
    context: Dict[str, Any]
    length: str = "standard"
    action: str = "generate"
    angle: Optional[str] = None
    current_caption: Optional[str] = None
    tone: Optional[str] = None
    lang: str = "fr"  # "en" for the English version of a post


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
    "Ne jamais inventer de chiffres, dates ou citations. "
    "FORME (texte publié tel quel sur LinkedIn) : texte brut, AUCUN markdown (pas de **, #, ##), "
    "paragraphes courts séparés par une ligne vide, hashtags éventuels sur la dernière ligne uniquement. "
    "Chaque phrase est grammaticalement complète et se suit logiquement : pas de phrase coupée ou "
    "laissée en suspens, pas de répétition d'une même idée, pas de connecteur incohérent "
    "(« ainsi », « en effet », « par conséquent » seulement s'ils sont justifiés). "
    "Accords, orthographe et ponctuation française corrects. Relis-toi avant de répondre."
)


# Inserted as a value inside f-strings, so single braces here (no escaping needed).
CHART_SCHEMA = (
    '{"type": "bar | pie | none", "title": "titre court du graphique (6-10 mots)", '
    '"unit": "unité commune : %, €, Md€, M€, ans, points… ou \'\'", '
    '"items": [{"label": "libellé court (max 4 mots)", "value": nombre}], '
    '"note": "lecture du graphique en 1 phrase courte ou \'\'"}'
)

CHART_RULES = (
    "GRAPHIQUE (visual.chart) : s'il existe au moins 2 valeurs chiffrées COMPARABLES dans la source "
    "(même unité : évolution dans le temps, comparaison entre acteurs/pays/régimes, répartition), "
    "remplis chart avec 2 à 6 items. 'value' est un NOMBRE pur (ex. 4.2, jamais \"4,2 %\"). "
    "type='pie' UNIQUEMENT pour une répartition dont les parts forment un tout (≈100 %) ; "
    "type='bar' pour une évolution ou une comparaison. "
    "N'utilise QUE des chiffres présents dans la source, n'invente ni n'estime aucune valeur. "
    "Sinon type='none' et items=[]."
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
    "insight_line": "phrase insight finale très courte pour le visuel",
    "chart": {CHART_SCHEMA}
  }},
  "caption": "caption LinkedIn complet prêt à publier",
  "quality": {{ "score": int 0-100, "criteria": {{"veracite": int, "nouveaute": int, "interet": int, "clarte": int, "originalite": int, "style": int}}, "suggestions": [] }},
  "sources": [{{"title": "", "url": ""}}]
}}
Choisis l'angle le PLUS pertinent (ne pas toujours le même). recommended_format='B' si le sujet repose sur un chiffre fort / plusieurs dates / comparaison, sinon 'A'.
{CHART_RULES}
Caption: {LENGTH_GUIDE.get(length, LENGTH_GUIDE['standard'])} {CAPTION_RULES}
Le score doit être exigeant et justifié."""


# ---------- House style & tone ----------
TONES = {
    "standard": "",
    "expert": ("TON : expert technique. Vocabulaire actuariel et réglementaire précis (SCR, best estimate, "
               "marge de risque, provisions techniques…), références exactes aux textes, raisonnement argumenté, "
               "pour un public d'actuaires, de directions financières et des risques."),
    "pedagogique": ("TON : pédagogique. Explique simplement chaque notion technique, une idée par paragraphe, "
                    "exemples concrets, sans jargon non expliqué, pour un public large (dirigeants, RH, assurés)."),
    "alerte": ("TON : alerte réglementaire. Accroche sur l'obligation ou l'échéance, puis ce qui change concrètement, "
               "qui est concerné, quoi faire et avant quand. Factuel, direct, sans dramatiser."),
}
STYLE_DEFAULT = {"tone": "standard", "avoid": [], "signature": "", "hashtags": [], "instructions": ""}


class StyleSettings(BaseModel):
    tone: str = "standard"
    avoid: List[str] = Field(default_factory=list)
    signature: str = ""
    hashtags: List[str] = Field(default_factory=list)
    instructions: str = ""


async def load_style() -> Dict[str, Any]:
    try:
        doc = await db.settings.find_one({"_id": "style"}) or {}
    except Exception:
        doc = {}
    doc.pop("_id", None)
    return {**STYLE_DEFAULT, **doc}


def style_block(style: Dict[str, Any], tone: Optional[str]) -> str:
    """House rules + chosen tone, appended to every writing prompt."""
    t = tone if tone in TONES else style.get("tone", "standard")
    parts = [TONES.get(t, "")]
    avoid = [a.strip() for a in style.get("avoid") or [] if a.strip()]
    if avoid:
        parts.append("FORMULES MAISON INTERDITES (ne jamais les employer, même reformulées de près) : "
                     + " ; ".join(f"« {a} »" for a in avoid) + ".")
    tags = [h.strip() if h.strip().startswith("#") else "#" + h.strip() for h in style.get("hashtags") or [] if h.strip()]
    if tags:
        parts.append("HASHTAGS MAISON à privilégier (2 ou 3 au plus, seulement s'ils sont pertinents) : " + " ".join(tags) + ".")
    if (style.get("instructions") or "").strip():
        parts.append("CONSIGNES MAISON : " + style["instructions"].strip())
    if (style.get("signature") or "").strip():
        parts.append("N'écris pas de signature : elle est ajoutée automatiquement.")
    return "\n".join(p for p in parts if p)


def apply_signature(caption: str, style: Dict[str, Any]) -> str:
    """Adds the house signature at the end of the text, just before the hashtag line."""
    sig = (style.get("signature") or "").strip()
    if not caption or not sig or sig in caption:
        return caption
    lines = caption.rstrip().split("\n")
    if lines and lines[-1].strip().startswith("#") and HASHTAG_RE.sub("", lines[-1]).strip() == "":
        return "\n".join(lines[:-1]).rstrip() + f"\n\n{sig}\n\n" + lines[-1]
    return caption.rstrip() + f"\n\n{sig}"


# ---------- Core logic ----------
async def store_generated(data: Dict[str, Any], origin: str) -> None:
    """Every generated post goes straight into "Mes posts" as a draft, so leaving the Studio
    (or closing the tab) never loses it."""
    now = datetime.now(timezone.utc).isoformat()
    title = (data.get("visual") or {}).get("title_short") or (data.get("meta") or {}).get("topic") or "Post FORSIDES"
    data.update({"saved": True, "title": title, "origin": origin, "updated_at": now})
    await db.posts.insert_one({**data, "created_at": now})


async def _noop_progress(step: str):
    return None


async def do_analyze_url(req: AnalyzeUrlReq, progress=_noop_progress) -> Dict[str, Any]:
    await progress("fetch")
    # scrape_url is blocking network code (up to ~30 s): run it in a thread so the server
    # keeps answering other requests (including the job polling) meanwhile.
    scraped = await asyncio.to_thread(scrape_url, req.url.strip())
    style = await load_style()
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

{ANALYSIS_INSTRUCTIONS(req.length)}
{style_block(style, req.tone)}"""
    await progress("ai")
    data = await llm_json(EDITORIAL_SYSTEM, prompt)
    await progress("finalize")
    normalize_scoring(data)
    normalize_chart(data)
    data["caption"] = apply_signature(clean_caption(data.get("caption") or ""), style)
    data["meta"] = data.get("meta") or {}
    data["meta"].update({
        "source": scraped["site_name"],
        "source_url": req.url,
        "source_title": scraped["title"] or "",
        "publication_date": scraped["published"] or "",
        "date_label": french_date_label(pub_dt),
        "image_url": scraped.get("image") or "",
    })
    data["source_text"] = scraped["text"]  # what the figures are checked against in the Studio
    if not data.get("sources"):
        data["sources"] = [{"title": scraped["site_name"], "url": req.url}]
    data["id"] = str(uuid.uuid4())
    await store_generated(data, "analyze")
    data.pop("_id", None)
    return data


def fetch_feed(rss_url: str):
    # Download with an explicit timeout (feedparser's own fetch has none and can hang).
    try:
        r = requests.get(rss_url, timeout=15, headers={"User-Agent": "Mozilla/5.0 FORSIDES News Studio"})
        r.raise_for_status()
    except Exception as e:
        logger.error(f"RSS fetch failed: {e}")
        raise HTTPException(status_code=503, detail="Google News ne répond pas pour le moment, réessayez.")
    return feedparser.parse(r.content)


def _words(s: str) -> set:
    return {w for w in re.findall(r"[a-zà-ÿ0-9]{4,}", (s or "").lower())}


def match_candidate(topic: Dict[str, Any], candidates: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    url = topic.get("source_url")
    for c in candidates:
        if url and c["link"] == url:
            return c
    tw = _words(f"{topic.get('title', '')} {topic.get('summary', '')}")
    best, score = None, 0.0
    for c in candidates:
        cw = _words(f"{c['title']} {c['snippet']}")
        if not cw:
            continue
        s = len(tw & cw) / len(cw) + (0.3 if topic.get("source") and topic["source"] == c["source"] else 0)
        if s > score:
            best, score = c, s
    return best if score >= 0.25 else None


# ---------- Companies & competitors filter ----------
# Actuarial / risk consulting firms competing with FORSIDES. Editable in the app
# ("Préciser la recherche" → "Concurrents à exclure"); this is only the default list.
DEFAULT_COMPETITORS = [
    "Milliman", "Addactis", "Optimind", "Actuelia", "Galea", "Fixage", "Prim'Act", "Actuaris",
    "SeaBird", "Sia Partners", "Mazars", "Forvis Mazars", "Deloitte", "KPMG", "EY", "Ernst & Young",
    "PwC", "PricewaterhouseCoopers", "Accenture", "Aon", "WTW", "Willis Towers Watson", "Mercer",
    "Nexialog", "Arengi", "Finalyse", "Reacfin", "Grant Thornton", "BDO", "Wavestone", "Capgemini",
]


def competitor_hit(text: str, names: List[str]) -> Optional[str]:
    low = (text or "").lower()
    for n in names:
        n = n.strip()
        if n and re.search(rf"(?<![\w]){re.escape(n.lower())}(?![\w])", low):
            return n
    return None


# ---------- Already posted? ----------
STOPWORDS = set("""dans pour avec sans sous entre leur leurs cette ces sont être avoir plus moins comme
mais aussi tout tous toute toutes selon après avant depuis vers chez très bien encore déjà alors
""".split())


def _sig_words(s: str) -> set:
    return {w for w in re.findall(r"[a-zà-ÿ0-9]{4,}", (s or "").lower()) if w not in STOPWORDS}


def _similar(a: str, b: str) -> float:
    wa, wb = _sig_words(a), _sig_words(b)
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / min(len(wa), len(wb))


async def mark_already_posted(topics: List[Dict[str, Any]]) -> None:
    """Flag topics that match a post saved in "Mes posts" (same article, or same subject)."""
    saved = await db.posts.find(
        {"saved": True},
        {"_id": 0, "id": 1, "title": 1, "meta.source_title": 1, "meta.source_url": 1,
         "meta.origin_url": 1, "scheduled_at": 1, "updated_at": 1},
    ).sort("updated_at", -1).limit(300).to_list(300)
    for t in topics:
        url = t.get("source_url") or ""
        best, best_score = None, 0.0
        for p in saved:
            m = p.get("meta") or {}
            if url and url in (m.get("source_url"), m.get("origin_url")):
                best, best_score = p, 1.0
                break
            sc = max(_similar(t.get("title", ""), p.get("title", "")),
                     _similar(t.get("title", ""), m.get("source_title", "")))
            if sc > best_score:
                best, best_score = p, sc
        if best and best_score >= 0.6:
            t["already_posted"] = {
                "id": best["id"],
                "title": best.get("title", ""),
                "date": best.get("scheduled_at") or best.get("updated_at") or "",
                "scheduled": bool(best.get("scheduled_at")),
            }


async def do_search(req: SearchReq, progress=_noop_progress) -> Dict[str, Any]:
    await progress("news")
    q = req.topic
    if req.institutions:
        q = f"{q} {req.institutions}"
    rss = f"https://news.google.com/rss/search?q={requests.utils.quote(q)}&hl=fr&gl=FR&ceid=FR:fr"
    feed = await asyncio.to_thread(fetch_feed, rss)
    await progress("filter")
    candidates = []
    competitors = req.competitors if req.competitors is not None else DEFAULT_COMPETITORS
    blocked = 0
    for entry in feed.entries[:24]:  # more candidates, since company news is removed below
        src = entry.source.title if entry.get("source") and entry.source.get("title") else ""
        summary = re.sub("<[^<]+?>", "", entry.get("summary", ""))[:280]
        # competitors are removed before the AI even sees them
        if competitor_hit(f"{entry.get('title', '')} {summary} {src}", competitors):
            blocked += 1
            continue
        if len(candidates) >= 16:
            break
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

Applique: DÉDUPLICATION (regroupe le même événement, garde la source primaire), FILTRAGE (élimine anciens/promotionnels/vagues/doublons/peu fiables, et ÉLIMINE SYSTÉMATIQUEMENT toute actualité centrée sur une entreprise en particulier : résultats ou chiffre d'affaires d'une société, rachat, levée de fonds, nomination, lancement de produit ou d'offre, partenariat, communication commerciale, classement d'entreprises ; ainsi que tout cabinet de conseil, d'actuariat ou d'audit, concurrent de FORSIDES. Ne garde que les sujets de marché, de réglementation, d'institutions, d'études et de tendances), SCORING /100 exigeant (pertinence assurance/actuariat, impact, actualité, fiabilité, potentiel LinkedIn), puis TRIAGE des {n} meilleurs sujets (exclure ceux déjà proposés).
Renvoie STRICTEMENT ce JSON, champs courts (summary 2 phrases max, why_attention et main_insight 1 phrase chacun):
{{"candidates_count": {len(candidates)}, "topics": [
  {{"title": "titre éditorial reformulé court", "source": "source primaire", "source_url": "lien fiable",
    "date": "date lisible", "summary": "", "why_attention": "", "main_insight": "", "sector": "",
    "priority": "PRIORITÉ ÉDITORIALE | TRÈS FORT | BON SUJET", "score": int 0-100,
    "company_focus": true si le sujet porte principalement sur une entreprise ou un cabinet en particulier, sinon false}}
]}}
N'invente rien: appuie-toi sur les titres/sources/snippets fournis."""
    await progress("ai")
    data = await llm_json(EDITORIAL_SYSTEM, prompt, FAST_MODEL)
    await progress("finalize")
    topics = [t for t in (data.get("topics") or []) if isinstance(t, dict) and t.get("title")]
    kept = []
    for t in topics:
        # second safety net on what the AI returns: company-centred topics and competitors are dropped
        if t.get("company_focus") is True or str(t.get("company_focus")).lower() == "true":
            blocked += 1
            continue
        if competitor_hit(" ".join(str(t.get(k) or "") for k in ("title", "summary", "source", "main_insight")), competitors):
            blocked += 1
            continue
        t.pop("company_focus", None)
        kept.append(t)
    topics = kept
    for t in topics:
        t["score"] = max(0, min(100, to_int(t.get("score"))))
    topics.sort(key=lambda t: t["score"], reverse=True)
    topics = topics[:n]
    for t in topics:
        # The AI sometimes rewrites or invents the link: always point to a real collected article,
        # and keep its snippet as a fallback source for the figure check.
        cand = match_candidate(t, candidates)
        if cand:
            if t.get("source_url") not in [c["link"] for c in candidates]:
                t["source_url"] = cand["link"]
            t["snippet"] = cand["snippet"]
            t.setdefault("source", cand["source"])
        t["id"] = str(uuid.uuid4())
        t.setdefault("date_label", french_date_label(None))
    try:
        await mark_already_posted(topics)
    except Exception as e:  # never fail a search because of this check
        logger.warning(f"already-posted check skipped: {e}")
    # topics already covered go to the bottom of the list (order kept otherwise)
    topics.sort(key=lambda t: 1 if t.get("already_posted") else 0)
    data["topics"] = topics
    data["excluded_companies"] = blocked
    if not topics:
        raise HTTPException(status_code=404, detail=(
            "Aucun sujet retenu : les résultats portaient sur des entreprises ou des concurrents. "
            "Reformulez la recherche (réglementation, marché, institution…)."))
    return data


# ---------- Google News link → real article ----------
GNEWS_HOST = "news.google.com"


def _gnews_article_id(url: str) -> Optional[str]:
    p = urlparse(url)
    if p.hostname != GNEWS_HOST:
        return None
    m = re.search(r"/(?:rss/)?articles/([^/?#]+)", p.path)
    return m.group(1) if m else None


def _gnews_decode_legacy(article_id: str) -> Optional[str]:
    """Older Google News ids embed the publisher URL directly in a base64 blob."""
    try:
        raw = base64.urlsafe_b64decode(article_id + "=" * (-len(article_id) % 4))
    except Exception:
        return None
    m = re.search(rb"https?://[^\x00-\x20\x7f-\xff\"<>]+", raw)
    if m and GNEWS_HOST.encode() not in m.group(0):
        return m.group(0).decode("utf-8", "ignore")
    return None


def _gnews_decode_batch(article_id: str) -> Optional[str]:
    """Current Google News ids: ask Google's own 'garturlreq' endpoint for the publisher URL
    (same call the news.google.com page makes in the browser)."""
    ua = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
    try:
        page = requests.get(f"https://{GNEWS_HOST}/rss/articles/{article_id}", headers=ua, timeout=10).text
        sig = re.search(r'data-n-a-sg="([^"]+)"', page)
        ts = re.search(r'data-n-a-ts="([^"]+)"', page)
        if not (sig and ts):
            return None
        inner = (
            '["garturlreq",[["X","X",["X","X"],null,null,1,1,"FR:fr",null,1,null,null,null,null,null,0,1],'
            f'"X","X",1,[1,1,1],1,1,null,0,0,null,0],"{article_id}",{ts.group(1)},"{sig.group(1)}"]'
        )
        payload = "f.req=" + requests.utils.quote(json.dumps([[["Fbv4je", inner]]]))
        r = requests.post(
            f"https://{GNEWS_HOST}/_/DotsSplashUi/data/batchexecute",
            data=payload, timeout=10,
            headers={**ua, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"},
        )
        parts = r.text.split("\n\n")
        body = parts[1] if len(parts) > 1 else parts[0]
        decoded = json.loads(json.loads(body)[0][2])[1]
        return decoded if isinstance(decoded, str) and decoded.startswith("http") else None
    except Exception as e:
        logger.info(f"gnews decode failed: {e}")
        return None


def resolve_article_url(url: str) -> str:
    """Return the publisher's article URL for a Google News link (or the URL unchanged)."""
    aid = _gnews_article_id(url or "")
    if not aid:
        return url
    real = _gnews_decode_legacy(aid) or _gnews_decode_batch(aid)
    if real:
        return real
    try:  # last chance: some links still answer with a plain HTTP redirect
        r = requests.get(url, timeout=10, allow_redirects=True, headers={"User-Agent": "Mozilla/5.0"})
        if urlparse(r.url).hostname not in (GNEWS_HOST, "consent.google.com"):
            return r.url
    except Exception:
        pass
    return url


def fetch_topic_article(url: str) -> Optional[Dict[str, Any]]:
    """Best effort: the full article behind a search result. None if it can't be read."""
    real = resolve_article_url(url)
    if not real or urlparse(real).hostname == GNEWS_HOST:
        return None
    try:
        scraped = scrape_url(real)
    except HTTPException:
        return None
    except Exception as e:
        logger.info(f"topic article scrape failed: {e}")
        return None
    return {**scraped, "url": real}


async def do_analyze_topic(req: AnalyzeTopicReq, progress=_noop_progress) -> Dict[str, Any]:
    t = req.topic
    await progress("fetch")
    # Read the actual article (not just the Google News headline + snippet) so the post can use
    # its figures, quotes and details, exactly like "Analyser un lien".
    article = await asyncio.to_thread(fetch_topic_article, t.get("source_url", ""))
    style = await load_style()
    if article:
        source_block = f"""ARTICLE COMPLET (lu sur {article['url']}):
TITRE ORIGINAL: {article['title']}
DATE DÉTECTÉE: {article['published'] or 'inconnue'}
CONTENU:
{article['text']}"""
    else:
        source_block = (
            "ATTENTION : l'article complet n'a pas pu être lu. Tu ne disposes que du titre et du résumé "
            "ci-dessus : n'avance AUCUN chiffre, date ou détail qui n'y figure pas."
        )
    prompt = f"""Sujet sélectionné pour production éditoriale FORSIDES:
TITRE: {t.get('title')}
SOURCE: {t.get('source')}
LIEN: {t.get('source_url', '')}
DATE: {t.get('date', '')}
RÉSUMÉ: {t.get('summary', '')}
POURQUOI: {t.get('why_attention', '')}
INSIGHT: {t.get('main_insight', '')}
SECTEUR: {t.get('sector', '')}

{source_block}

{ANALYSIS_INSTRUCTIONS(req.length)}
{style_block(style, req.tone)}
Le bloc scoring reprend/affine le scoring déjà établi (score global {t.get('score')})."""
    await progress("ai")
    data = await llm_json(EDITORIAL_SYSTEM, prompt)
    await progress("finalize")
    normalize_scoring(data)
    normalize_chart(data)
    data["caption"] = apply_signature(clean_caption(data.get("caption") or ""), style)
    data["meta"] = data.get("meta") or {}
    source_url = article["url"] if article else t.get("source_url", "")
    data["meta"].update({
        "source": t.get("source", ""),
        "source_url": source_url,
        "source_title": (article or {}).get("title") or t.get("title", ""),
        "summary": t.get("summary", ""),
        "publication_date": t.get("date", ""),
        "date_label": t.get("date_label") or french_date_label(None),
        "image_url": "",
        "article_read": bool(article),
        "origin_url": t.get("source_url", ""),  # search link, to recognise this topic in later searches
    })
    # what the figures will be checked against in the Studio
    data["source_text"] = article["text"] if article else "\n".join(
        str(t.get(k) or "") for k in ("title", "summary", "snippet"))
    if not data.get("sources"):
        data["sources"] = [{"title": t.get("source", ""), "url": source_url}]
    data["id"] = str(uuid.uuid4())
    await store_generated(data, "research")
    data.pop("_id", None)
    return data


async def do_compose(req: ComposeReq, progress=_noop_progress) -> Dict[str, Any]:
    await progress("ai")
    prompt = f"""Voici un texte destiné à un post LinkedIn (rédigé par l'utilisateur):
\"\"\"{req.caption}\"\"\"

À partir de CE TEXTE uniquement (ne rien inventer), prépare les éléments du visuel LinkedIn FORSIDES.
Renvoie STRICTEMENT ce JSON:
{{
  "meta": {{ "topic": "sujet en quelques mots", "sector": "secteur", "source": "institution ou média cité dans le texte ou ''", "source_title": "titre de l'étude/rapport/article cité ou ''" }},
  "editorial": {{ "fact": "résumé fidèle du texte en 2 phrases", "what_changes": "ce qui change, 1 phrase ou ''", "why_important": "pourquoi c'est important, 1 phrase ou ''", "insight": "phrase insight tirée du texte ou ''", "angle": "angle dominant du texte" }},
  "visual": {{
    "recommended_format": "A ou B",
    "title_short": "titre éditorial court et fort tiré du texte (10-16 mots), reformulé, sans guillemets",
    "key_figure_value": "chiffre clé présent dans le texte ou ''",
    "key_figure_label": "libellé court du chiffre ou ''",
    "important_date": "date/échéance présente ou ''",
    "data_points": ["2 à 4 points clés très courts tirés du texte"],
    "insight_line": "phrase finale courte pour le visuel",
    "chart": {CHART_SCHEMA}
  }}
}}
{CHART_RULES} (Ici, la « source » est le texte de l'utilisateur.)"""
    data = await llm_json(EDITORIAL_SYSTEM, prompt)
    normalize_chart(data)
    data["meta"] = data.get("meta") or {}
    data["meta"].setdefault("date_label", french_date_label(None))
    data["meta"].setdefault("source", "")
    data["meta"]["image_url"] = ""
    data["caption"] = req.caption
    data["source_text"] = req.caption  # the user's own text is the reference for the figure check
    return data


# ---------- Job system (bypasses 60s edge timeout) ----------
JOB_MAX_AGE = timedelta(minutes=6)   # a job still pending after this was lost (e.g. server restart)
JOB_TTL_HOURS = 24                    # finished jobs are deleted automatically after a day
_running_tasks: set = set()           # keep references so background jobs aren't garbage-collected mid-run


async def run_job(job_id: str, coro):
    try:
        result = await coro
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "done", "result": result}})
    except HTTPException as e:
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "error", "detail": str(e.detail)}})
    except Exception:
        logger.exception("job failed")
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "error", "detail": "Erreur interne, réessayez."}})


async def start_job(make_coro) -> Dict[str, str]:
    """make_coro(progress) builds the job; progress("step") records the real current phase,
    which the loading screen shows instead of a timer."""
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    await db.jobs.insert_one({"id": job_id, "status": "pending", "step": "start",
                              "created_at": now.isoformat(), "created_dt": now})

    async def progress(step: str):
        try:
            await db.jobs.update_one({"id": job_id}, {"$set": {"step": step}})
        except Exception:
            pass  # progress is cosmetic: never fail the job because of it

    task = asyncio.create_task(run_job(job_id, make_coro(progress)))
    _running_tasks.add(task)
    task.add_done_callback(_running_tasks.discard)
    return {"job_id": job_id}


@app.on_event("startup")
async def ensure_indexes():
    try:
        await db.jobs.create_index("id", unique=True)
        await db.jobs.create_index("created_dt", expireAfterSeconds=JOB_TTL_HOURS * 3600)
        await db.posts.create_index("id")
        await db.posts.create_index([("saved", 1), ("updated_at", -1)])
    except Exception as e:  # never block startup on an index problem
        logger.warning(f"index creation skipped: {e}")


@api_router.get("/")
async def root():
    return {"message": "FORSIDES News Studio API"}


@api_router.post("/jobs/analyze-url")
async def job_analyze_url(req: AnalyzeUrlReq):
    return await start_job(lambda progress: do_analyze_url(req, progress))


@api_router.post("/jobs/search")
async def job_search(req: SearchReq):
    return await start_job(lambda progress: do_search(req, progress))


@api_router.post("/jobs/analyze-topic")
async def job_analyze_topic(req: AnalyzeTopicReq):
    return await start_job(lambda progress: do_analyze_topic(req, progress))


@api_router.post("/jobs/compose")
async def job_compose(req: ComposeReq):
    return await start_job(lambda progress: do_compose(req, progress))


@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    doc = await db.jobs.find_one({"id": job_id}, {"_id": 0, "created_dt": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Job introuvable")
    if doc.get("status") == "pending":
        try:
            started = datetime.fromisoformat(doc.get("created_at", ""))
            if datetime.now(timezone.utc) - started > JOB_MAX_AGE:
                return {**doc, "status": "error", "detail": "Le traitement a été interrompu, relancez-le."}
        except ValueError:
            pass
    return doc


@api_router.post("/caption")
async def caption(req: CaptionReq):
    ctx = req.context
    style = await load_style()
    action_map = {
        "generate": "Rédige le caption.",
        "regenerate": "Régénère un caption différent, nouvel angle rédactionnel, même sujet.",
        "shorten": "Raccourcis fortement le caption actuel (environ -35%) en gardant l'essentiel.",
        "analytical": "Réécris le caption dans un registre plus analytique et argumenté.",
        "accessible": "Réécris le caption pour le rendre plus accessible et pédagogique, sans perdre la valeur technique.",
        "change_angle": f"Réécris le caption avec un nouvel angle éditorial: {req.angle}.",
        "restyle": ("Réécris le caption actuel pour respecter la longueur cible et le ton demandés ci-dessous, "
                    "en gardant les mêmes faits, chiffres et angle (ne rien ajouter qui ne soit dans le sujet)."),
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
{style_block(style, req.tone)}
{ENGLISH_RULE if req.lang == "en" else ""}
Renvoie UNIQUEMENT le texte du caption, sans guillemets ni commentaire."""
    text = await llm_text(CAPTION_SYSTEM, prompt)
    return {"caption": apply_signature(clean_caption(text, req.lang), style)}


ENGLISH_RULE = (
    "LANGUE : rédige le caption en ANGLAIS britannique professionnel (et non en français), "
    "avec les conventions anglaises (decimal point, € before amounts : €4.2bn), en gardant toutes les règles ci-dessus."
)


class TranslateReq(BaseModel):
    content: Dict[str, Any]


TRANSLATE_SYSTEM = (
    "You are a senior financial translator specialised in insurance, actuarial science, social protection "
    "and EU regulation (Solvency II, IFRS 17, EIOPA). You translate French LinkedIn content into natural, "
    "professional British English as a native editor would write it (not word for word). You never add, "
    "remove or change any fact, figure or date. You answer ONLY with valid JSON."
)


@api_router.post("/translate")
async def translate(req: TranslateReq):
    """English version of a post: caption + every text shown on the visual and chart."""
    prompt = f"""Translate every French string value of this JSON into English and return the SAME JSON structure
(same keys, same list lengths, same order). Rules:
- Figures: keep exactly the same values, English formatting (183,4 → 183.4 ; 1 250 → 1,250 ; 4,1 % → 4.1%).
- Units: Md€ → €bn, M€ → €m, k€ → €k, "ans" → "years", "mois" → "months"; keep % as is.
- Institutions: use their usual English names (ACPR → ACPR, la DREES → DREES, Sécurité sociale → French Social Security,
  Cour des comptes → French Court of Audit, France Assureurs → France Assureurs).
- LinkedIn caption: keep paragraphs, line breaks, arrows and hashtags (translate hashtags only if a common English
  one exists, e.g. #Assurance → #Insurance). Keep the signature line as is if it is a proper name.
- Keep empty strings empty. Do not translate keys.
JSON:
{json.dumps(req.content, ensure_ascii=False)}"""
    data = await llm_json(TRANSLATE_SYSTEM, prompt)
    if isinstance(data.get("caption"), str):
        data["caption"] = clean_caption(data["caption"], "en")
    return data


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
    data = await llm_json(EDITORIAL_SYSTEM, prompt)
    data["score"] = max(0, min(100, to_int(data.get("score"))))
    return data


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


class SavePostReq(BaseModel):
    id: Optional[str] = None
    title: str = ""
    caption: str = ""
    thumbnail: str = ""
    meta: Dict[str, Any] = Field(default_factory=dict)
    scoring: Optional[Dict[str, Any]] = None
    editorial: Optional[Dict[str, Any]] = None
    visual: Optional[Dict[str, Any]] = None
    quality: Optional[Dict[str, Any]] = None
    sources: Optional[List[Dict[str, Any]]] = None
    scheduled_at: Optional[str] = None
    origin: str = "studio"
    source_text: str = ""
    translated_from: Optional[str] = None  # EN post → its French original
    english_id: Optional[str] = None       # FR post → its English version


@api_router.post("/posts/save")
async def save_post(req: SavePostReq):
    pid = req.id or str(uuid.uuid4())
    doc = req.model_dump()
    doc["id"] = pid
    doc["saved"] = True
    for k in ("source_text", "translated_from", "english_id"):
        if not doc.get(k):
            doc.pop(k, None)  # never wipe a stored value with an empty one
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.posts.update_one({"id": pid}, {"$set": doc}, upsert=True)
    return {"id": pid}


@api_router.get("/posts")
async def list_posts():
    cursor = db.posts.find(
        {"saved": True},
        {"_id": 0, "id": 1, "title": 1, "caption": 1, "thumbnail": 1, "meta": 1,
         "scoring.total": 1, "scheduled_at": 1, "updated_at": 1, "origin": 1},
    ).sort("updated_at", -1).limit(300)
    items = await cursor.to_list(300)
    return {"posts": items}


@api_router.post("/posts/{post_id}/duplicate")
async def duplicate_post(post_id: str):
    """Copy a saved post as a new draft (no schedule) to start a new post from it."""
    doc = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Introuvable")
    new_id = str(uuid.uuid4())
    title = doc.get("title") or (doc.get("visual") or {}).get("title_short") or "Post FORSIDES"
    doc.update({
        "id": new_id,
        "title": f"{title} (copie)",
        "scheduled_at": None,
        "saved": True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.posts.insert_one(doc)
    doc.pop("_id", None)
    return {"id": new_id}


@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str):
    res = await db.posts.delete_one({"id": post_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Introuvable")
    return {"ok": True}


@api_router.get("/settings/style")
async def get_style():
    return await load_style()


@api_router.put("/settings/style")
async def put_style(req: StyleSettings):
    doc = req.model_dump()
    doc["tone"] = doc["tone"] if doc["tone"] in TONES else "standard"
    doc["avoid"] = [a.strip() for a in doc["avoid"] if a.strip()][:40]
    doc["hashtags"] = [h.strip() for h in doc["hashtags"] if h.strip()][:10]
    doc["signature"] = doc["signature"].strip()[:300]
    doc["instructions"] = doc["instructions"].strip()[:1500]
    await db.settings.update_one({"_id": "style"}, {"$set": doc}, upsert=True)
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
