# Proposte di miglioramento

Backlog delle idee per Expenses Monitor. Ogni voce ha uno stato:
`💡 proposta` · `🔨 in corso` · `✅ fatto` · `❌ scartata`

Per aggiungere un'idea: crea una voce nella sezione giusta con stato, descrizione breve e, se serve, note tecniche.

---

## 1. Import movimenti da banca e PayPal

### 1.1 Import da file CSV / Excel — 💡 proposta · priorità **alta**
Importare gli estratti conto scaricati dall'home banking e da PayPal (*Attività → Estratti conto → CSV*).
- Parser lato browser (nessun server, massima privacy), anche per file `.xlsx`.
- Mappatura colonne guidata (data, descrizione, importo, segno) **salvata per banca**, così la seconda volta è automatica.
- Deduplica: per id transazione se presente, altrimenti hash di data + importo + descrizione.
- Categoria suggerita da regole ("ESSELUNGA" → Spesa, "ENEL" → Bollette) e dallo storico.
- Riconoscimento automatico dei pagamenti delle bollette ricorrenti (segna "pagata").
- Anteprima prima della conferma, con possibilità di escludere righe.
- Costo 0, sforzo basso-medio. È l'unico metodo che copre con certezza PayPal con un conto personale.
- **Da decidere:** quale banca supportare per prima (serve un file di esempio, anche con importi anonimizzati).

### 1.2 Sincronizzazione automatica con la banca (Enable Banking) — 💡 proposta · priorità media
Collegamento in **sola lettura** tramite open banking PSD2.
- **Enable Banking** in "restricted mode" è gratuito per l'uso personale sui propri conti e copre le principali banche italiane (Intesa, UniCredit, BPM, BPER, MPS, Fineco, Mediolanum, BCC, CBI Globe…).
- La chiave privata **non può stare nell'app** (GitHub Pages è pubblico): serve un mini backend, per esempio un **Cloudflare Worker** (piano gratuito) che firma le richieste e restituisce i movimenti. I dati salvati restano solo nel browser.
- Proteggere il Worker con un token personale o Cloudflare Access, con CORS limitato all'origine dell'app, e senza log dei dati.
- Consenso PSD2 da rinnovare **ogni 180 giorni**: mostrare la scadenza e un pulsante "Ricollega banca", con avviso 7 giorni prima.
- Riusa la deduplica e le regole di categoria del punto 1.1.
- **Prima di iniziare:** registrarsi su Enable Banking e verificare che la propria banca (ed eventualmente PayPal) sia supportata, e quanti giorni di storico fornisce.

### 1.3 PayPal via API — ❌ scartata (per ora)
La Transaction Search API di PayPal funziona solo con un **account Business**. Con un conto personale si usa l'import CSV (punto 1.1).

### Opzioni valutate e scartate
- **GoCardless Bank Account Data (ex Nordigen):** non accetta nuove registrazioni da luglio 2025.
- **Tink, Plaid, TrueLayer, Yapily, Salt Edge, Fabrick, CBI Globe:** pensati per aziende (contratto o licenza).
- **Accesso PSD2 diretto da privato:** richiede licenza AISP e certificato eIDAS.
- **Lettura delle email di ricevuta:** richiede accesso alla casella e un backend, ed è fragile.

---

## 2. Grafica e fluidità

- ✅ Tema chiaro/scuro/sistema con palette adattata per tema.
- ✅ Swipe sulle spese (sinistra elimina con "Annulla", destra duplica) e swipe tra mesi/anni.
- ✅ Tastierino stile calcolatrice con somme e sottrazioni.
- ✅ Header compatto allo scroll, toast, skeleton, stati vuoti illustrati, vibrazioni leggere.
- 💡 Haptics più ricchi su Android (Vibration API) per conferme e cancellazioni.
- 💡 Icona e splash screen PNG dedicati per iOS (`apple-touch-icon`), oltre all'SVG.

## 3. Funzionalità

- ✅ Budget per categoria con avvisi all'80% e oltre.
- ✅ Stima di fine mese, media giornaliera e scheda "Approfondimenti".
- ✅ Banner bollette scadute o in scadenza entro 7 giorni, con badge sulla scheda.
- ✅ Note e metodo di pagamento; suggerimenti automatici dallo storico.
- ✅ Ricerca su tutti i mesi; confronto anno su anno nel riepilogo annuale.
- 💡 **Entrate e saldo netto** mensile e annuale.
- 💡 **Allegati**: foto dello scontrino o PDF della bolletta, salvati in IndexedDB.
- 💡 **Etichette** libere (es. "vacanze 2026", "auto") oltre alle categorie.
- 💡 **Obiettivi di risparmio**.
- 💡 **Notifiche** locali per le bollette in scadenza (dove supportate dalle PWA).

## 4. Dati e affidabilità

- 💡 **Backup automatico periodico**: promemoria se l'ultimo backup è più vecchio di 30 giorni (il dato `lastBackup` è già salvato).
- 💡 **Sincronizzazione tra dispositivi** opzionale e cifrata end-to-end, per esempio su un file in Google Drive o iCloud scelto dall'utente.
- 💡 **Test automatici** (Vitest) per la logica di ricorrenze, formattazione e import, eseguiti in CI prima del deploy.
