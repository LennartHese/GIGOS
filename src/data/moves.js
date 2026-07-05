export const MOVES = {
  kratzer:{ name:'Kratzer', pow:7, type:'Normal', acc:1.0, desc:'Schnelle Krallen quer ueber den Pelz.' },
  satz:{ name:'Satz nach vorn', pow:11, type:'Normal', acc:0.9, desc:'Voller Koerpereinsatz mit Anlauf.' },
  biss:{ name:'Biss', pow:9, type:'Normal', acc:0.95, desc:'Beherzt zugebissen.' },
  fauchen:{ name:'Fauchen', pow:0, type:'Status', acc:1.0, eff:'atkdown', val:0.3, desc:'Lautes Fauchen senkt den Angriff des Gegners.' },
  rauchbombe:{ name:'Rauchbombe', pow:6, type:'Chaos', acc:0.95, desc:'Beissender Qualm vernebelt das Sichtfeld.' },
  augenrollen:{ name:'Augenrollen', pow:5, type:'Chaos', acc:1.0, desc:'So derbe geeked, der Gegner schaut nur verwirrt zu.' },

  // ---------- Nüchtern ----------
  spreespritzer:{ name:'Spree-Spritzer', pow:10, type:'Nüchtern', acc:0.95, desc:'Ein Schwall Spreewasser mit ordentlich Rückenwind.' },
  plastikwurf:{ name:'Plastik-Wurf', pow:9, type:'Nüchtern', acc:0.95, desc:'Ein Fetzen Kanal-Müll fliegt scharf durch die Luft.' },
  flossenklatsche:{ name:'Flossenklatsche', pow:9, type:'Nüchtern', acc:1.0, desc:'Ein nasser Klatscher mit der Flosse.' },
  muelltonnenraid:{ name:'Mülltonnen-Raid', pow:12, type:'Nüchtern', acc:0.85, desc:'Der komplette Inhalt der Mülltonne auf einmal.' },
  pfoetchen:{ name:'Pfötchen', pow:6, type:'Nüchtern', acc:1.0, desc:'Ein niedlicher, aber überraschend fester Tatzenhieb.' },
  sturzflug:{ name:'Sturzflug', pow:12, type:'Nüchtern', acc:0.85, desc:'Steiler Sturzflug, Volltreffer von oben.' },
  schnabelhieb:{ name:'Schnabelhieb', pow:9, type:'Nüchtern', acc:0.95, desc:'Ein gezielter Hieb mit dem Schnabel.' },
  krallen:{ name:'Krallen', pow:10, type:'Nüchtern', acc:0.9, desc:'Scharfe Krallen, ungebremster Einsatz.' },
  boom:{ name:'Boom', pow:14, type:'Nüchtern', acc:0.8, desc:'Es macht einfach nur laut BOOM.' },
  pfandwurf:{ name:'Pfandwurf', pow:8, type:'Nüchtern', acc:1.0, desc:'Eine geworfene Pfandflasche, 25 Cent Schaden garantiert.' },
  tagbombe:{ name:'Tag-Bombe', pow:13, type:'Nüchtern', acc:0.85, desc:'Explodiert erst, wenn es am wenigsten passt.' },
  capwurf:{ name:'Cap-Wurf', pow:9, type:'Nüchtern', acc:0.95, desc:'Die Cap fliegt tief ins Gesicht des Gegners.' },
  schnellesgeschaeft:{ name:'Schnelles Geschäft', pow:8, type:'Nüchtern', acc:1.0, desc:'Schnell hin, schnell weg, keiner hat was gesehen.' },
  augenauf:{ name:'Augen-auf', pow:7, type:'Nüchtern', acc:1.0, desc:'Kurz hingeschaut, dann zugeschlagen.' },
  hupkonzert:{ name:'Hupkonzert', pow:11, type:'Nüchtern', acc:0.9, desc:'Dauerhupen aus naechster Naehe, ohrenbetaeubend.' },
  biokeule:{ name:'Bio-Keule', pow:10, type:'Nüchtern', acc:0.95, desc:'Zertifiziert bio, tut trotzdem richtig weh.' },
  lastenradramme:{ name:'Lastenrad-Ramme', pow:19, type:'Nüchtern', acc:0.85, desc:'Volle Fahrt mit dem Lastenrad, keine Bremse in Sicht.' },

  // ---------- Downer ----------
  schlammschlag:{ name:'Schlammschlag', pow:11, type:'Downer', acc:0.9, desc:'Ein müder, aber schwerer Schlag durchs Schlammufer.' },
  tollwutbiss:{ name:'Tollwut-Biss', pow:19, type:'Downer', acc:0.85, desc:'Ein Biss mit Schaum vorm Maul, die stärkste Waffe des Fuchses.' },
  nachtsprung:{ name:'Nachtsprung', pow:12, type:'Downer', acc:0.9, desc:'Aus der Dunkelheit heraus, keiner sieht ihn kommen.' },
  bueckware:{ name:'Bückware', pow:10, type:'Downer', acc:0.95, desc:'Ware unterm Ladentisch, träge aber treffsicher.' },

  // ---------- Upper ----------
  ueberflieger:{ name:'Überflieger', pow:12, type:'Upper', acc:0.9, desc:'Kreist hibbelig immer höher, dann der Sturzangriff.' },
  nachtschwaermer:{ name:'Nachtschwärmer', pow:11, type:'Upper', acc:0.9, desc:'Tanzt sich in Rage, bis der Angriff sitzt.' },
  augenaufriss:{ name:'Augen-Aufriss', pow:10, type:'Upper', acc:0.95, desc:'Pupillen weit, Puls hoch, Volltreffer.' },
  bassdrop:{ name:'Bass-Drop', pow:20, type:'Upper', acc:0.8, desc:'Der Bass droppt, der ganze Raum bebt — stärkste Attacke der Raver.' },
  glowstickwirbel:{ name:'Glowstick-Wirbel', pow:10, type:'Upper', acc:0.95, desc:'Leuchtstäbe wirbeln in schwindelerregendem Tempo.' },
  dauertanz:{ name:'Dauertanz', pow:11, type:'Upper', acc:0.9, desc:'Tanzt einfach durch, bis der Gegner umkippt.' },
  crackwatschn:{ name:'Crackwatschn', pow:15, type:'Upper', acc:0.85, desc:'Eine ruckartige, unberechenbare Ohrfeige.' },
  schnorrattacke:{ name:'Schnorr-Attacke', pow:8, type:'Upper', acc:1.0, desc:'Nervt so lange, bis der Gegner nachgibt.' },
  zittern:{ name:'Zittern', pow:9, type:'Upper', acc:0.95, desc:'Zittrige Hände treffen trotzdem überraschend hart.' },
  ticken:{ name:'Ticken', pow:9, type:'Upper', acc:0.95, desc:'Schnelles Geschäft mit hartem Nachdruck.' },

  // ---------- Psychie ----------
  glitzerklau:{ name:'Glitzer-Klau', pow:9, type:'Psychie', acc:0.95, desc:'Klaut kurz was Glänzendes und haut damit zu.' },
  spruehstoss:{ name:'Sprühstoß', pow:10, type:'Psychie', acc:0.9, desc:'Ein Schuss aus der pinken Sprühdose, mitten ins Gesicht.' },
  dampfe:{ name:'Dämpfe', pow:11, type:'Psychie', acc:0.9, desc:'Beissende Dämpfe vernebeln Sinn und Verstand.' },

  // ---------- Status: schwächt (Gegnerschaden -30%) ----------
  oekopredigt:{ name:'Öko-Predigt', pow:0, type:'Status', acc:1.0, eff:'atkdown', val:0.3, desc:'Eine endlose Moralpredigt übers Klima — der Gegner verliert die Lust anzugreifen.' },
  comedown:{ name:'Comedown', pow:0, type:'Status', acc:1.0, eff:'atkdown', val:0.3, desc:'Der Rausch ist vorbei, der Antrieb gleich mit.' },

  // ---------- Status: Gegner greift sich selbst an (~35%) ----------
  khole:{ name:'K-Hole', pow:0, type:'Status', acc:1.0, eff:'selfhit', val:0.35, desc:'Der Gegner verschwindet kurz im K-Hole und trifft sich selbst.' },
  pupillenblitz:{ name:'Pupillen-Blitz', pow:0, type:'Status', acc:1.0, eff:'selfhit', val:0.35, desc:'Ein greller Blitz in geweiteten Pupillen — totale Verwirrung.' },

  // ---------- Status: verwirrt, setzt zu 30% aus ----------
  tunnelblick:{ name:'Tunnelblick', pow:0, type:'Status', acc:1.0, eff:'skip', val:0.3, desc:'Der Blick verengt sich zum Tunnel, der Gegner setzt öfter mal aus.' },
  verwirrung:{ name:'Verwirrung', pow:0, type:'Status', acc:1.0, eff:'skip', val:0.3, desc:'Alles dreht sich, der Gegner findet nicht mehr zum Angriff.' },
  liebesblick:{ name:'Liebesblick', pow:0, type:'Status', acc:1.0, eff:'skip', val:0.3, desc:'Ein Blick zum Dahinschmelzen — der Gegner vergisst kurz, wofür er hier ist.' },
  quakschock:{ name:'Quak-Schock', pow:0, type:'Status', acc:1.0, eff:'skip', val:0.3, desc:'Ein schriller Quak-Ton lähmt kurz die Konzentration.' },

  // ---------- Status: demotiviert, setzt zu 50% aus ----------
  kraechzen:{ name:'Krächzen', pow:0, type:'Status', acc:1.0, eff:'skip', val:0.5, desc:'Ein durchdringendes Krächzen — total demotivierend.' },
  heutenicht:{ name:'Heute leider nicht', pow:0, type:'Status', acc:1.0, eff:'skip', val:0.5, desc:'"Heute leider nicht." Mehr muss nicht gesagt werden.' },

  // ---------- Team-Support ----------
  mollypeptalk:{ name:'Molly-Pep-Talk', pow:0, type:'Status', acc:1.0, eff:'teamdmg', val:0.10, desc:'Eine aufmunternde Ansprache, das ganze Team fühlt sich unbesiegbar.' },
  suffansprache:{ name:'Suff-Ansprache', pow:0, type:'Status', acc:1.0, eff:'teamheal', val:0.30, desc:'Eine schwankende, aber ehrliche Ansprache — das Team rappelt sich auf.' },
  naloxon:{ name:'Naloxon', pow:0, type:'Status', acc:1.0, eff:'immune', desc:'Ein Teammate wird gegen jeden Status-Quatsch immun.' },
};
