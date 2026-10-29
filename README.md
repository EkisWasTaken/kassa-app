<p align="center"><img src="build/icon.png" width="96" alt=""></p>

# Kassa

Ett skrivbordsprogram för Windows som hjälper dig ha koll på din ekonomi: vart pengarna tar vägen, vilka prenumerationer du betalar för, hur mycket du sparar och hur dina investeringar går.

**All data stannar på din dator.** Inget konto, ingen inloggning, ingen molntjänst. Du importerar kontoutdrag som du själv exporterar från din bank.

## Ladda ner

1. Gå till [**Releases**](../../releases/latest) och ladda ner `Kassa Setup x.y.z.exe`.
2. Kör filen. Windows visar troligen en varning ("Windows skyddade datorn") eftersom programmet inte är signerat med ett köpt certifikat. Klicka **Mer information** → **Kör ändå**.
3. Kassa hamnar på skrivbordet och i Start-menyn.

## Kom igång

1. Logga in på din internetbank och exportera kontoutdraget/transaktionerna som **Excel** eller **CSV**. Ta gärna flera månader bakåt.
2. Öppna Kassa och klicka **+ Importera**. Välj en eller flera filer. Dubbletter hoppas över, så det gör inget om filerna överlappar.
3. Gå igenom **Månadskoll**: bekräfta dina prenumerationer, markera egna överföringar och sätt kategori på det som hamnat i Övrigt.

Banker som ska fungera: Swedbank, Handelsbanken, SEB, Nordea, Länsförsäkringar och ICA Banken. Kassa letar upp kolumnerna för datum, text och belopp själv, så andra banker fungerar ofta också. Säg till om din banks fil inte går att läsa.

## Vad Kassa gör

- **Översikt**: inkomst, utgifter och sparande per månad, kassaflöde, kalender över dagliga utgifter och vart pengarna går.
- **Månadskoll**: en checklista efter varje import (nya prenumerationer, dubbelbetalningar, ovanligt stora köp, konton att uppdatera).
- **Budget och sparmål**: budget per kategori med prognos, sparmål med beräknat datum när du når dem.
- **Investeringar**: ISK, sparkonton och andra konton, avkastning och nettoförmögenhet över tid.
- **År**: hela året kategori för kategori, jämfört med året innan.
- **Prenumerationer**: bara det du själv bekräftar räknas, med prishistorik och varningar vid prishöjningar.
- **Säkerhetskopior**: automatiskt efter varje import och en gång per dygn, till OneDrive om du har det.
- Ljust och mörkt tema.

## Var finns min data?

- Data: `%APPDATA%\Kassa\kassa.json`
- Säkerhetskopior: `OneDrive\Kassa backup` (eller `Dokument\Kassa backup`). Du kan byta mapp under Inställningar.

## För utvecklare

Electron + Vue 3 + ECharts. Kräver Node 20+.

```bash
npm install
npm run dev        # i webbläsaren, http://localhost:5173
npm start          # som skrivbordsapp
npm test           # logiken i src/logic.js
npm run dist:win   # bygger installationsfilen till release/
```
