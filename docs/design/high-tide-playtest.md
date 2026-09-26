# High Tide: speltest 26. september 2026

Fire justeringsrundar brukte vanleg spelmotor og tastetrykk. Det vart testa
åleine og med to klientar, med 100 ms simulert forseinking kvar veg. Ingen
posisjonar, helse, skade eller oppgraderingar vart gitt av testpiloten. Ei eiga
førebuing målte plattformhopp for ruteval; sjølve rundane måtte gå og hoppe ruta.

## Funn og endringar

1. Første 150-sekundstest samla ingen sideoppgraderingar. Hopp vart fanga av
   stengelen, og to-spelar-verten stod att med ein gammal gjesteposisjon ved
   botnen. Retningshopp er no frie, og klatring har jamn fart langs svingane.
2. Ein utslått klatrar kunne bli flytta til bakken langt under vatnet. Kroppen
   blir no verande der spelaren fall. Redning og vidare synk er testa.
3. Oppgraderingar for hausting vart tilbodne i ein modus utan hausting, og fleire
   planteoppgraderingar mangla verknad. Vala er avgrensa til relevante effektar.
   Sidefunn gir ein lagra vekstspurt og er meir verd å oppsøkje.
4. Sein bossskade auka kraftig med klokka, også når tida gjekk til stell og redning.
   Skaden følgjer no vaktarane og vanskegraden. Vatn treng påfyll oftare, og aktivt
   stell gir spelaren ei moglegheit til å hente seg inn mellom angrepa.

Undervegs vart òg inputpiloten retta: han sende stundom hopp før retninga, valde
same gjesteoppgradering fleire gonger før svar, og prøvde å hoppe opp att når han
skulle gripe stengelen. Dette var feil i måleverktøyet og er ikkje spelendringar.

## Siste runde, Medium

| Oppsett | Utfall | Tid | Sideoppgraderingar |
| --- | --- | ---: | ---: |
| Mech, hovudsakleg stengel | Fall ved siste vaktar | 292 s | 0 |
| Mech, utforsking | Alle fem, nådde krona | 182 s | 3 |
| Mech + Herbalist | Alle fem, nådde krona | 190 s | 4 |
| Runner + Bulwark | Alle fem, nådde krona | 221 s | 3 |
| Sligo + Pølge | Alle fem, nådde krona | 171 s | 4 |

Fullstendige målingar ligg i `high-tide-playtest.json`. Resultata viser at
sidevegane kan løne seg og at begge klientane kan fullføre, men dei er ikkje ei
måling av kor moro ekte menneske har det. Pilotane er deterministiske og kjenner
kartet. Nettverket brukar dei verkelege input- og snapshot-funksjonane, men
ikkje Supabase-transporten. Testen simulerer forseinking, ikkje pakketap.

Nettlesarkontrollen i `scripts/check-high-tide-browser.cjs` opnar også to
verkelege spelrammer og testar framdrift, synk, manuelt sidehopp og pause i
Chromium og WebKit. Han lagrar skjermbilete i CI. Dei eksisterande telefonprøvane
for planting med trykk/tastatur og alle fem bossane er med vidare.
