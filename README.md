# Expenses Monitor 💸

App personale per monitorare le spese mensili e annuali: bollette, abbonamenti, spesa, trasporti…
Tutto resta **sul tuo dispositivo** (local-first, nessun server, nessun account) e funziona anche **offline** come PWA installabile.

## Funzionalità

- **Dashboard mensile** – totale speso con contatore animato, confronto col mese precedente, barra del budget con la **stima a fine mese**, media giornaliera, ripartizione per categoria (donut) con **budget per categoria** e avvisi, andamento cumulativo con proiezione tratteggiata e linea del budget, ultime spese.
- **Approfondimenti** – categorie che hanno sforato o stanno per sforare il budget, maggiore aumento/diminuzione rispetto al mese scorso, giorno più caro, giorni rimanenti.
- **Promemoria bollette** – banner con le bollette scadute o in scadenza nei prossimi 7 giorni (con "Paga" diretto) e badge sulla scheda Bollette.
- **Inserimento rapido** – tastierino stile calcolatrice su telefono (somme e sottrazioni: `12,50+4`), suggerimenti dallo storico che compilano descrizione, categoria e importo, data "Oggi/Ieri" con un tocco, **metodo di pagamento** (contanti, carta, bonifico) e **nota** facoltativi. Su desktop il tasto <kbd>N</kbd> apre una nuova spesa.
- **Spese** – lista raggruppata per giorno, ricerca (descrizione, nota, categoria) anche **in tutti i mesi**, filtro per categoria. Scorri una spesa a sinistra per eliminarla (con **Annulla**), a destra per **duplicarla** oggi; su desktop le stesse azioni compaiono al passaggio del mouse.
- **Bollette & ricorrenti** – luce, gas, affitto, Netflix… con frequenza mensile/bimestrale/trimestrale/semestrale/annuale. Ogni mese vedi cosa scade, cosa è scaduto e con "Paga" registri l'importo reale (le bollette variano!). Costo fisso medio mensile e annuale.
- **Riepilogo annuale** – totale, media mensile, mese più caro, confronto con l'anno precedente anche **mese per mese** (barre affiancate), categorie dell'anno.
- **Opzioni** – tema chiaro/scuro/sistema, budget mensile, categorie personalizzabili (nome, colore, icona, budget), backup/ripristino JSON, esportazione CSV (con metodo e nota), reset.

### Fluidità
- Tema **chiaro e scuro** (segue il sistema o si sceglie a mano, con transizione morbida dei colori); i colori delle categorie usano il gradino adatto a ciascuna superficie.
- **Scorri col dito tra i mesi** (o gli anni) su Home, Spese, Bollette e Anno; i contenuti entrano dal lato giusto, come le transizioni tra schede.
- Header compatto che compare scorrendo la Home, bottom sheet trascinabile dalla maniglia, toast con barra del tempo, skeleton di caricamento, stati vuoti illustrati, vibrazioni leggere (dove supportate).
## Stack e scelte

| Ambito | Scelta | Perché |
|---|---|---|
| UI | React 19 + TypeScript + Vite | veloce, tipizzato |
| Stile | Tailwind CSS v4, temi chiaro/scuro "glass" con token semantici | design fluido, gradienti, blur, contrasto corretto in entrambi i temi |
| Animazioni | [Motion](https://motion.dev) | spring, layout animations, transizioni di pagina, bottom sheet trascinabile, numeri animati |
| Dati | IndexedDB tramite [Dexie](https://dexie.org) + `useLiveQuery` | local-first: l'interfaccia si aggiorna da sola a ogni modifica, zero latenza |
| Grafici | Recharts | donut, area, barre con tooltip |
| Offline | vite-plugin-pwa (Workbox) | installabile su telefono/desktop, funziona senza rete |

Best practice applicate:
- **Importi in centesimi interi** (niente errori di arrotondamento con i float).
- **Date in formato `YYYY-MM-DD`** indicizzate: le query per mese/anno sono range su indice.
- `navigator.storage.persist()` per chiedere al browser di non cancellare i dati.
- **Backup esportabile**: i dati vivono solo nel browser, quindi fai un backup JSON ogni tanto.
- Rispetta `prefers-reduced-motion` e `prefers-color-scheme`.
- Note, metodo di pagamento e budget di categoria sono campi non indicizzati: nessuna migrazione dello schema, i dati esistenti restano validi.

## Avvio

```bash
npm install
npm run dev       # sviluppo su http://localhost:5173
npm run build     # build di produzione in dist/
npm run preview   # anteprima della build
```

## Server sul telefono e accesso di Claude

Facoltativo: un server Node senza dipendenze (`server/`) gira in Termux sul telefono, l'app si sincronizza con lui
e Claude gestisce i dati tramite un connettore MCP. Si riavvia da solo (runit, watchdog, Termux:Boot) e fa backup giornalieri.
Setup passo passo: [docs/SETUP.md](docs/SETUP.md) · Come funziona: [docs/TELEFONO.md](docs/TELEFONO.md).

## Installarla sul telefono

Il workflow `.github/workflows/deploy.yml` pubblica l'app su GitHub Pages a ogni push su `main`
(abilita *Settings → Pages → Source: GitHub Actions*). Apri l'URL dal telefono e usa
"Aggiungi a schermata Home". I dati restano comunque solo sul dispositivo.

## Struttura

```
src/
  db.ts               schema Dexie, categorie di default, backup/ripristino
  lib/                formattazione €/date, ricorrenze, hook dati, tema, approfondimenti, azioni (elimina/duplica)
  components/         UI riutilizzabile (sheet, form, tastierino, toast, grafici, nav, numeri animati)
  pages/              Dashboard, Spese, Bollette, Anno, Opzioni
```
