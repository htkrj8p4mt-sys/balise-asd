# Balise ASD

Veille et market intelligence sur l'aéronautique et le spatial, civils et militaires, en France et en Europe.

## Fonctionnement

1. `.github/workflows/veille.yml` se lance toutes les heures.
2. `scripts/collect.py` lit les flux de `scripts/sources.json` et envoie les nouveaux articles à l'API Claude, qui les classe et les résume.
3. Les résultats sont ajoutés à `site/data.json`, puis le dossier `site/` est publié sur GitHub Pages.

## Configuration

Ajouter la clé API dans **Settings → Secrets and variables → Actions**, sous le nom `ANTHROPIC_API_KEY`. Ne jamais la mettre dans le code.

## Ajouter une source

Ajouter une ligne dans `scripts/sources.json` : le nom et l'adresse du flux RSS.
