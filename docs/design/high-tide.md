# High Tide: morplanta og dei fem hagane

Den forkasta omarbeidinga i `11a9e4c` tok berre med kollisjonsflatene frå nivåfila,
reduserte dei til ein 480-pikslars oppgang og teikna standardplattformer over dei.
Denne versjonen erstattar både den visinga og den korte vekstkonkurransen.

## Kartet

Heile Level Studio-komposisjonen er teken inn: 178 grafiske element og 118
usynlege gangflater. Utsnitt, lagrekkjefølgje, plassering og opasitet er bevarte.
Koordinatane er native spelpikslar. Oppgangen frå start til siste gangflate er
1370 pikslar, og biletkjelde og kollisjonar har same origo. Ingen tilfeldig jord,
holebakgrunn eller erstatningsfliser dekkjer kartet. Kjelde og byggjeskript er
omtala i `assets/levels-v1/README.md`.

## Rytmen

1. Plant den eine morplanta. Ho byrjar med vatn til ei utforskingstur.
2. Bruk plattformene til å hente ti oppgraderingar og ni doggdråpar. Oppgraderingar
   gir val som verkar i denne modusen. Dogg fyller vatn og helse og bremsar floa.
   Begge funna gir ein kort dobbel vekstspurt. Spurtane ventar bak ein låst vaktar.
3. Stell frå bakken eller ein vaksen del av stengelen. Det fyller vatn og plantehelse, og hjelper ein såra spelar tilbake i kampen.
   Planta veks av seg sjølv medan ho har vatn, også medan spelaren er borte.
4. Kvar etappe sluttar ved ein vaktar. Vidare vekst ventar på at vaktaren er slått.
   Mossback stormar fram, Bellkeeper varslar salver, Moon Moth har eit avbrytbart
   sug mot planta, den andre Bellkeeper legg fleire angrep saman, og Hollow Crown
   avsluttar med fleire fasar og press mot laget.
5. Siger gir eit oppgraderingsval, delvis heling, 90 pikslar lågare vatn og 12 sekund
   kvile. Etter fem vaktarar må ein levande spelar faktisk nå krona.

Floa går etter klokka, aldri etter spelarposisjonen. Den låste kamparenaen blir
ikkje oversvømd før vaktaren er slått. Fall og gamle sidevegar kan bli farlege.
Tørke stansar vekst og tærer på planta. Fiendar kan tappe henne. Plantetap eller
at heile laget går ned avsluttar forsøket. Ein medspelar kan gjenopplivast med
stell i tre sekund dersom kroppen er over vatnet.

Sligo får att startmassen ved å stelle planta og kan vekse vidare frå kjøt som
fiendane slepper. Slik kan han halde fram med sjefskampane utan å hauste den eine
morplanta. Vekst frå kjøt og deling brukar den vanlege kolonimodellen.

## Startbalanse

| Nivå | Pusterom før flo | Grunnfart på vatn | Pust under vatn |
| --- | ---: | ---: | ---: |
| Easy | 60 s | 3,1 px/s | 4 s |
| Medium | 45 s | 4,1 px/s | 3,4 s |
| Hard | 35 s | 4,8 px/s | 3 s |
| Insane | 28 s | 5,5 px/s | 2,6 s |

Grunnveksten er 8 px/s. Vaktarane har 14, 23, 33, 45 og 62 grunnhelse. Skaden aukar med vaktarane og valt vanskegrad, utan ein ekstra
tidsstraff for utforsking eller redning. Fleire spelarar aukar grunnhelsa med 55 %
per ekstra spelar. Fiendetaket er fire vanlege fiendar i tillegg til vaktaren.
Vasstapet er 1,6 % per sekund før oppgraderingar; stell fyller 18 % per sekund.
Quick roots gir 35 % meir vekst per rang, Deep soil gir 30 % mindre vasstap,
og Sap, Thorns, Barkskin, Mulch og Sap burst har verknad også langs morstengelen.
Speltestrundane og avgrensingane er dokumenterte i `high-tide-playtest.md`.

## Kontroll

`tests/high-tide*.test.cjs` dekkjer alle 75 hopp langs hovudruta med Bulwark utan
oppgraderingar, tilkomst til alle samlepunkta, ordinære bomber mot vaktarane,
varsla angrep, stell, tørke, drukning, Sligo, fleirspelar og byte av vert.
`review.html?mode=high-tide&portrait=1` brukar den verkelege motoren med isolerte
lagringar. `&zone=0` til `&zone=4` opnar kvar sjefskamp; `&still=1` frys biletet.

## Rørsle og samarbeid

Retningshopp held seg frie frå stengelen, også i lufta. Stå nær stengelen og hopp
utan sideretning for å gripe han. Klatrefarten blir målt langs svingane, slik at
begge klientane sender rørsle verten kan godta. Ein utslått klatrar blir verande
på staden og kan reddast, utan å bli flytta til botnen av kartet.

`playtest.html` opnar to isolerte motorar med vanleg input og 100 ms forseinking
kvar veg. Ingen konto, lagring eller offentleg lobby blir brukt. Dei valfrie
pilotane trykkjer berre dei vanlege tastane. Knappane over kvart bilete tek over
manuelt. `scripts/playtest-high-tide.cjs` køyrer same inputpilot ved 30 Hz.
