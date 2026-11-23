# Dashboard marketing Hoffman Cable

Vue unifiée de hoffmancables.shop (jour, semaine, mois) qui regroupe **Google Analytics 4**, **Google Search Console** et **Shopify** sur une seule page, avec comparaison à la période précédente ou à N-1, et des insights calculés automatiquement.

- **Public = mode démo** : n'importe qui peut ouvrir le lien, les chiffres sont simulés (et signalés comme tels).
- **Données réelles** : bouton « Données réelles » puis mot de passe (`DASHBOARD_PASSWORD`). Les clés API restent sur le serveur Vercel et ne passent jamais par le navigateur.

## Architecture

```
index.html            page unique (charte hoffmancables.shop : Assistant, #121212, bordeaux #7A1620)
assets/
  app.js              rendu, filtres, graphiques (Chart.js)
  demo.js             générateur de données de démonstration
  normalize.js        fusion GA4 + Search Console + Shopify (partagé navigateur / serveur)
  insights.js         règles des insights automatiques
  periods.js          calcul des périodes (Europe/Paris, N-1 = 364 jours)
api/                  fonctions serverless Vercel
  data.js             GET /api/data?range=day|week|month (protégé par mot de passe, cache 5 min)
  status.js           GET /api/status (dit si les données réelles sont activées)
  _lib/               connecteurs ga4.js, gsc.js, shopify.js, google.js (auth compte de service)
```

Aucune dépendance npm et aucune étape de build : Vercel sert la page et exécute `api/`.

## KPIs

| Bloc | Indicateurs | Source |
|---|---|---|
| L'essentiel | CA, commandes, panier moyen, taux de conversion, sessions, sessions SEO, clics Google, position moyenne | Shopify, GA4, GSC |
| Acquisition | sessions, part, évolution, achats, conversion et CA par canal ; entonnoir sessions → panier → paiement → achat ; abandon panier | GA4 |
| SEO organique | clics, impressions, CTR, position ; top requêtes et pages ; opportunités (positions 4 à 20, gain de clics estimé) | Search Console |
| E-commerce | CA, commandes, panier moyen, taux de remboursement, top produits, nouveaux / récurrents | Shopify |
| Audience | utilisateurs, engagement, durée, pages / session, appareils, pages d'entrée | GA4 |
| Temps réel | visiteurs actifs (30 dernières minutes) | GA4 Realtime |

## Brancher les données réelles

### 1. Google (GA4 + Search Console) : un compte de service

1. Sur [console.cloud.google.com](https://console.cloud.google.com), crée un projet, puis active **Google Analytics Data API** et **Google Search Console API**.
2. *IAM et administration → Comptes de service* : crée un compte, puis *Clés → Ajouter une clé → JSON*. Garde ce fichier en lieu sûr.
3. **GA4** : *Admin → Gestion des accès à la propriété* → ajoute l'email du compte de service (`…@….iam.gserviceaccount.com`) en **Lecteur**. Note l'**ID de propriété** (numérique).
4. **Search Console** : *Paramètres → Utilisateurs et autorisations* → ajoute le même email (accès **Restreint** suffit).

### 2. Shopify

Depuis janvier 2026, les nouvelles apps se créent dans le **Dev Dashboard** :

1. *Admin Shopify → Paramètres → Applications → Développer des applications* → Dev Dashboard → créer une app.
2. Portées (scopes) : **`read_orders` uniquement** — aucune donnée client n'est lue. Ajoute `read_all_orders` pour comparer à plus de 60 jours (N-1).
3. Installe l'app sur la boutique, puis récupère le **Client ID** et le **Client secret**.

(Si une ancienne custom app existe déjà avec un jeton `shpat_…`, `SHOPIFY_ADMIN_TOKEN` suffit.)

### 3. Variables d'environnement Vercel

*Projet Vercel → Settings → Environment Variables* (voir `.env.example`) :

| Variable | Exemple |
|---|---|
| `DASHBOARD_PASSWORD` | un mot de passe long |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | contenu complet du fichier JSON |
| `GA4_PROPERTY_ID` | `412345678` |
| `GSC_SITE_URL` | `sc-domain:hoffmancables.shop` ou `https://www.hoffmancables.shop/` |
| `SHOPIFY_STORE_DOMAIN` | `xxxx.myshopify.com` |
| `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` | depuis le Dev Dashboard |

Redéploie ensuite le projet. Le pied de page indique l'état de chaque source (connecté / erreur / non configuré).

## Limites connues

- Search Console : les 2 à 3 derniers jours sont souvent incomplets.
- Sécurité : mot de passe de 12 caractères minimum, blocage 15 min après 5 essais ratés, mot de passe jamais stocké dans le navigateur, en-têtes CSP / anti-iframe / HSTS.
- Le CA affiché est celui de Shopify (TTC, frais de port inclus, hors commandes test et annulées). Sans Shopify, c'est le `purchaseRevenue` de GA4.
- GA4 sous-compte les achats quand le visiteur refuse les cookies : l'écart avec Shopify est normal.
