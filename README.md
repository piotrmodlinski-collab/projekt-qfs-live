# QFS Website

Nowoczesna strona WWW dla studia gamedev QFS.

## Struktura
- index.html
- produkcje.html
- outsourcing.html
- zespol.html
- kontakt.html
- styles.css
- app.js
- robots.txt
- sitemap.xml
- PLAN_WDROZENIA_QFS.md
- AUDYT_QFS_PRO.md

## Najwazniejsze elementy
- zachowana kolorystyka marki (magenta + orange)
- rozdzielenie produkcji (wlasne vs outsourcing)
- sekcje video gameplay
- nowoczesny layout desktop/mobile
- sekcje wiarygodnosci i pipeline produkcyjny
- gotowosc SEO (OG, robots, sitemap)

## Backend auth (panel)
- endpoint logowania: `/logowanie`
- zabezpieczony panel: `/panel`
- autoryzacja: tymczasowo login + haslo (`PANEL_LOGIN`, `PANEL_PASSWORD`)
- opcjonalnie: Google OAuth 2.0 (po ustawieniu `GOOGLE_CLIENT_ID` i `GOOGLE_CLIENT_SECRET`)
- sesje: `express-session` (HttpOnly, SameSite, secure w production)
- limit prob logowania: `express-rate-limit`

### Konfiguracja
1. Skopiuj `.env.example` do `.env` i uzupelnij wartosci.
2. Ustaw lokalny login/haslo panelu:
   - `PANEL_LOGIN=admin`
   - `PANEL_PASSWORD=QFS123!`
3. (Opcjonalnie) W Google Cloud Console ustaw `Authorized redirect URI`:
   - `http://localhost:3000/auth/google/callback` (lokalnie)
   - lub URI z Twojej domeny produkcyjnej.
