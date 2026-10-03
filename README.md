# Expenses Monitor 💸

App personale per monitorare le spese mensili e annuali: bollette, abbonamenti, spesa, trasporti…
Tutto resta **sul tuo dispositivo** (local-first, nessun server, nessun account) e funziona anche **offline** come PWA installabile.

## Funzionalità

- **Dashboard mensile** – totale speso con contatore animato, confronto col mese precedente, barra del budget, ripartizione per categoria (donut), andamento cumulativo del mese, ultime spese.
- **Spese** – lista raggruppata per giorno, ricerca, filtro per categoria, modifica/eliminazione con un tap.
- **Bollette & ricorrenti** – luce, gas, affitto, Netflix… con frequenza mensile/bimestrale/trimestrale/semestrale/annuale. Ogni mese vedi cosa scade, cosa è scaduto e con "Paga" registri l'importo reale (le bollette variano!). Costo fisso medio mensile e annuale.
- **Riepilogo annuale** – totale, media mensile, mese più caro, confronto con l'anno precedente, grafico per mese (tocca una barra per aprire quel mese), categorie dell'anno.
- **Opzioni** – budget mensile, categorie personalizzabili (nome, colore, icona), backup/ripristino JSON, esportazione CSV (apribile in Excel), reset.

## Stack e scelte

| Ambito | Scelta | Perché |
|---|---|---|
| UI | React 19 + TypeScript + Vite | veloce, tipizzato |
| Stile | Tailwind CSS v4, tema scuro "glass" | design fluido, gradienti, blur |
| Animazioni | [Motion](https://motion.dev) | spring, layout animations, transizioni di pagina, bottom sheet trascinabile, numeri animati |
| Dati | IndexedDB tramite [Dexie](https://dexie.org) + `useLiveQuery` | local-first: l'interfaccia si aggiorna da sola a ogni modifica, zero latenza |
| Grafici | Recharts | donut, area, barre con tooltip |
| Offline | vite-plugin-pwa (Workbox) | installabile su telefono/desktop, funziona senza rete |

Best practice applicate:
- **Importi in centesimi interi** (niente errori di arrotondamento con i float).
- **Date in formato `YYYY-MM-DD`** indicizzate: le query per mese/anno sono range su indice.
- `navigator.storage.persist()` per chiedere al browser di non cancellare i dati.
- **Backup esportabile**: i dati vivono solo nel browser, quindi fai un backup JSON ogni tanto.
- Rispetta `prefers-reduced-motion`.

## Avvio

```bash
npm install
npm run dev       # sviluppo su http://localhost:5173
npm run build     # build di produzione in dist/
npm run preview   # anteprima della build
```

## Installarla sul telefono

Il workflow `.github/workflows/deploy.yml` pubblica l'app su GitHub Pages a ogni push su `main`
(abilita *Settings → Pages → Source: GitHub Actions*). Apri l'URL dal telefono e usa
"Aggiungi a schermata Home". I dati restano comunque solo sul dispositivo.

## Struttura

```
src/
  db.ts               schema Dexie, categorie di default, backup/ripristino
  lib/                formattazione €/date, logica ricorrenze, hook dati
  components/         UI riutilizzabile (sheet, form, grafici, nav, numeri animati)
  pages/              Dashboard, Spese, Bollette, Anno, Opzioni
```
