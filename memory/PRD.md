# FORSIDES News Studio — PRD

## Problem statement
Application web premium transformant une actualité/sujet en post LinkedIn prêt à publier via une vraie chaîne éditoriale de veille (assurance, actuariat, protection sociale : EIOPA, ACPR, DREES, France Assureurs, Solvabilité II, IFRS 17). Recherche → collecte → filtrage → déduplication → scoring → triage → analyse éditoriale → angle → génération → contrôle qualité → visuel.

## User choices
- LLM éditorial : Claude Sonnet 4.6 (Emergent Universal Key)
- Visuels : canvas HTML5 (template FORSIDES) + image IA Gemini Nano Banana
- Récupération : scraping de lien (Mode 1) + recherche web live Google News RSS (Mode 2)
- Accès libre (pas d'auth)

## Architecture
- Frontend React (react-router, Tailwind, shadcn, sonner), state via StudioContext.
- Backend FastAPI + MongoDB, emergentintegrations.
- **Async job + polling** (`/api/jobs/*` + `GET /api/jobs/{id}`) pour contourner le timeout edge ~60s sur les appels LLM longs.
- Visuel rendu client-side sur canvas 1200×1500 (4:5), export PNG.

## Implemented (2026)
- Mode 1 — Analyser un lien : scrape (UA + Referer + fallback r.jina.ai, og:image), analyse Claude → meta, scoring /100 (7 critères), analyse éditoriale, angle, caption, quality, sources.
- Mode 2 — Explorer un sujet : Google News RSS (14 candidats), dédup/filtrage/scoring/triage Claude → 5-6 sujets triés par score ; badges priorité 🥇🥈🥉 ; "Rafraîchir la sélection" (exclusion des sujets déjà proposés).
- Mode 3 — Éditeur libre (/compose) : texte LinkedIn → visuel live à côté ; "Optimiser avec l'IA" (titre/format/data).
- Studio 2 colonnes : ScorePanel (jauge + 7 sous-scores + forces/faiblesses/reco), AnalysisPanel, CaptionEditor (Court/Standard/Analytique/Décryptage ; régénérer/raccourcir/analytique/accessible/changer d'angle ; copier ; contrôle qualité avec alerte si <75), VisualPreview.
- VisualPreview fidèle au template : fond blush, slab NEWS brique, date MOIS 2026, logo FORSIDES (transparent), logo source (upload), titre bordeaux justifié, image plein cadre (version A) / infographie data (version B), signature script "For you, by your side". Export PNG + export post complet (PNG + .txt).
- Endpoints directs : /api/caption (texte pur, CAPTION_SYSTEM), /api/quality, /api/visual-image (Gemini).

## Status
- Testé : backend 100%, frontend 100% (Modes 1/2/3, Studio, export, + Historique/Programmation/2 Concepts/Logos auto). Timeout 60s résolu.

## Added features (v2)
- **Mes posts (Historique)** : enregistrer un post, galerie (thumbnail + score + date programmée), rouvrir dans le Studio, supprimer. Endpoints /api/posts/save (upsert), GET /api/posts, GET /api/post/{id}, DELETE /api/posts/{id}.
- **Programmation LinkedIn** : dialogue date/heure, statut « Programmé » stocké. Publication LinkedIn réelle = **SIMULÉE (mock)**, clairement signalée (bannière + toast).
- **2 concepts** : aperçu côte à côte Version A (Actualité/image) et Version B (Data/Insight) avant génération, sélection en un clic.
- **Logos institutionnels auto** : ACPR & Banque de France (vrais logos), EIOPA/Cour des comptes/DREES/France Assureurs/INSEE/OCDE/Commission européenne (emblèmes typographiques on-brand) affichés automatiquement selon la source ; upload manuel toujours possible.

## Backlog / next
- P2 : bibliothèque de logos institutionnels auto (EIOPA/ACPR/Cour des comptes) au lieu d'upload manuel.
- P2 : réduire latence /api/jobs/search (étage dédup Haiku + scoring Sonnet).
- P2 : proposer 2 concepts visuels avant génération quand plusieurs formats pertinents.
- P2 : historique des posts générés (collection posts déjà persistée).
