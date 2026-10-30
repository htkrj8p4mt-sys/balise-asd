# Balise ASD

Veille et market intelligence sur l'aéronautique et le spatial, civils et militaires, en France et en Europe.

## Fonctionnement

`.github/workflows/veille.yml` lance `scripts/collect.py` toutes les heures, puis publie le dossier `site/` sur GitHub Pages.

- **Sans clé :** le flux direct (`site/flux.json`, à partir de `scripts/sources.json`) et les appels d'offres de l'API publique TED.
- **Avec une clé Groq gratuite :** les articles sont aussi résumés, expliqués et classés dans `site/data.json`.

## Configuration

Créer une clé sur https://console.groq.com, puis l'ajouter dans **Settings → Secrets and variables → Actions** sous le nom `GROQ_API_KEY`. Ne jamais la mettre dans le code.

## Ajouter une source

Ajouter une ligne dans `scripts/sources.json` : le nom et l'adresse du flux RSS.
