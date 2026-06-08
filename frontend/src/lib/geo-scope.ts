// Zones are stored in lowercase for matching; display names are Title Case.
// Keys = constituency name (lowercase). Values = lowercase zone names for matching.
const CONSTITUENCY_ZONES: Record<string, string[]> = {
  // ── Greater Accra ─────────────────────────────────────────────────────────
  "ayawaso west wuogon": [
    "dzorwulu", "abelemkpe", "airport residential", "okponglo",
    "roman ridge", "east legon",
  ],
  "ayawaso central": [
    "asylum down", "north labone", "south labone", "ridge",
    "cantonments", "osu",
  ],
  "ayawaso east": [
    "adenta", "pantang", "abokobi", "dome", "kwabenya",
  ],
  "ayawaso north": [
    "achimota", "ofankor", "pokuase", "amasaman",
  ],
  "okaikwei north": [
    "abossey okai", "alajo", "nima", "maamobi", "accra new town",
  ],
  "okaikwei south": [
    "kaneshie", "mataheko", "gbegbeyise", "kokompe",
  ],
  "ablekuma north": [
    "dansoman", "mamprobi", "bubuashie", "odorkor",
  ],
  "ablekuma central": [
    "kwashieman", "awoshie", "tetegu",
  ],
  "ablekuma west": [
    "gbawe", "weija", "oblogo", "kasoa north",
  ],
  "la-dade-kotopon": [
    "la", "labadi", "teshie", "nungua",
  ],
  "krowor": [
    "nungua", "baatsona", "sakumono", "community 18",
  ],
  "ledzokuku": [
    "teshie", "east legon hills", "community 25",
  ],
  "korle-klottey": [
    "jamestown", "ussher town", "sempe", "chorkor", "mamprobi south",
  ],
  "klottey korle": [
    "jamestown", "ussher town", "sempe",
  ],
  "ga central": [
    "amasaman", "pokuase", "sowutuom", "chantan",
  ],
  "ga east": [
    "haatso", "agbogba", "madina", "oyibi",
  ],
  "ga north": [
    "pokuase", "amasaman", "nsawam",
  ],
  "ga south": [
    "weija", "gbawe", "kokrobite", "kasoa",
  ],
  "ga west": [
    "accra hills", "amasaman", "ablekuma",
  ],
  "tema west": [
    "community 1", "community 2", "community 3", "ashaiman",
  ],
  "tema central": [
    "community 4", "community 5", "community 6", "manhean",
  ],
  "tema east": [
    "dawhenya", "afienya", "prampram",
  ],
  "adenta": [
    "adenta", "frafraha", "oyarifa",
  ],
  "ashaiman": [
    "ashaiman", "tulako", "nii kpakpa",
  ],
  "kpone-katamanso": [
    "kpone", "katamanso", "devtraco", "community 20",
  ],
  "ningo-prampram": [
    "prampram", "ningo", "dawhenya", "aveyime",
  ],
  "shai-osudoku": [
    "dodowa", "osudoku", "akuse",
  ],
  "ada east": [
    "ada foah", "kasseh", "totope",
  ],
  "ada west": [
    "sege", "battor", "mepe",
  ],
  "north tongu": [
    "adidome", "battor", "juapong",
  ],
  "weija-gbawe": [
    "weija", "gbawe", "kasoa", "bortianor",
  ],

  // ── Ashanti ───────────────────────────────────────────────────────────────
  "kumasi central": [
    "adum", "manhyia", "bantama", "subin",
  ],
  "bantama": [
    "bantama", "nhyiaeso", "suame",
  ],
  "suame": [
    "suame", "magazine", "ahensan",
  ],
  "asokwa": [
    "asokwa", "kaase", "atonsu",
  ],
  "oforikrom": [
    "oforikrom", "kentinkrono", "emena",
  ],
  "tafo": [
    "tafo", "pankrono", "buokrom",
  ],
  "nhyiaeso": [
    "nhyiaeso", "fante new town", "asawase",
  ],
  "kwadaso": [
    "kwadaso", "kodie", "abuakwa",
  ],
  "old tafo": [
    "old tafo", "new tafo", "buokrom",
  ],

  // ── Central Region ────────────────────────────────────────────────────────
  "cape coast north": [
    "abura", "eguafo", "abirem", "pedu",
  ],
  "cape coast south": [
    "cape coast", "moree", "bakaano", "kotokuraba",
  ],

  // ── Western Region ────────────────────────────────────────────────────────
  "sekondi": [
    "sekondi", "takoradi", "market circle", "effiakuma",
  ],
  "takoradi": [
    "takoradi", "harbour area", "anaji",
  ],

  // ── Northern Region ───────────────────────────────────────────────────────
  "tamale central": [
    "tamale", "lamashegu", "choggu",
  ],
  "tamale north": [
    "tamale north", "vitin", "changli",
  ],
  "tamale south": [
    "tamale south", "gurugu",
  ],

  // ── Eastern Region ────────────────────────────────────────────────────────
  "koforidua": [
    "koforidua", "effiduase", "new juaben",
  ],
};

// Display-case zone names keyed by constituency (lowercase → Title Case labels).
// Allows the UI to present pretty names while matching uses lowercase.
const CONSTITUENCY_ZONE_LABELS: Record<string, string[]> = {
  "ayawaso west wuogon": [
    "Dzorwulu", "Abelemkpe", "Airport Residential", "Okponglo",
    "Roman Ridge", "East Legon",
  ],
  "ayawaso central": [
    "Asylum Down", "North Labone", "South Labone", "Ridge",
    "Cantonments", "Osu",
  ],
  "ayawaso east": ["Adenta", "Pantang", "Abokobi", "Dome", "Kwabenya"],
  "ayawaso north": ["Achimota", "Ofankor", "Pokuase", "Amasaman"],
  "okaikwei north": ["Abossey Okai", "Alajo", "Nima", "Maamobi", "Accra New Town"],
  "okaikwei south": ["Kaneshie", "Mataheko", "Gbegbeyise", "Kokompe"],
  "ablekuma north": ["Dansoman", "Mamprobi", "Bubuashie", "Odorkor"],
  "ablekuma central": ["Kwashieman", "Awoshie", "Tetegu"],
  "ablekuma west": ["Gbawe", "Weija", "Oblogo", "Kasoa North"],
  "la-dade-kotopon": ["La", "Labadi", "Teshie", "Nungua"],
  "krowor": ["Nungua", "Baatsona", "Sakumono", "Community 18"],
  "ledzokuku": ["Teshie", "East Legon Hills", "Community 25"],
  "korle-klottey": ["Jamestown", "Ussher Town", "Sempe", "Chorkor", "Mamprobi South"],
  "ga central": ["Amasaman", "Pokuase", "Sowutuom", "Chantan"],
  "ga east": ["Haatso", "Agbogba", "Madina", "Oyibi"],
  "ga north": ["Pokuase", "Amasaman", "Nsawam"],
  "ga south": ["Weija", "Gbawe", "Kokrobite", "Kasoa"],
  "ga west": ["Accra Hills", "Amasaman", "Ablekuma"],
  "tema west": ["Community 1", "Community 2", "Community 3", "Ashaiman"],
  "tema central": ["Community 4", "Community 5", "Community 6", "Manhean"],
  "tema east": ["Dawhenya", "Afienya", "Prampram"],
  "adenta": ["Adenta", "Frafraha", "Oyarifa"],
  "ashaiman": ["Ashaiman", "Tulako", "Nii Kpakpa"],
  "kpone-katamanso": ["Kpone", "Katamanso", "Devtraco", "Community 20"],
  "ningo-prampram": ["Prampram", "Ningo", "Dawhenya", "Aveyime"],
  "shai-osudoku": ["Dodowa", "Osudoku", "Akuse"],
  "ada east": ["Ada Foah", "Kasseh", "Totope"],
  "ada west": ["Sege", "Battor", "Mepe"],
  "north tongu": ["Adidome", "Battor", "Juapong"],
  "weija-gbawe": ["Weija", "Gbawe", "Kasoa", "Bortianor"],
  "kumasi central": ["Adum", "Manhyia", "Bantama", "Subin"],
  "bantama": ["Bantama", "Nhyiaeso", "Suame"],
  "suame": ["Suame", "Magazine", "Ahensan"],
  "asokwa": ["Asokwa", "Kaase", "Atonsu"],
  "oforikrom": ["Oforikrom", "Kentinkrono", "Emena"],
  "tafo": ["Tafo", "Pankrono", "Buokrom"],
  "nhyiaeso": ["Nhyiaeso", "Fante New Town", "Asawase"],
  "kwadaso": ["Kwadaso", "Kodie", "Abuakwa"],
  "old tafo": ["Old Tafo", "New Tafo", "Buokrom"],
  "cape coast north": ["Abura", "Eguafo", "Abirem", "Pedu"],
  "cape coast south": ["Cape Coast", "Moree", "Bakaano", "Kotokuraba"],
  "sekondi": ["Sekondi", "Takoradi", "Market Circle", "Effiakuma"],
  "takoradi": ["Takoradi", "Harbour Area", "Anaji"],
  "tamale central": ["Tamale", "Lamashegu", "Choggu"],
  "tamale north": ["Tamale North", "Vitin", "Changli"],
  "tamale south": ["Tamale South", "Gurugu"],
  "koforidua": ["Koforidua", "Effiduase", "New Juaben"],
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function getZonesForConstituency(constituency: string | null | undefined): string[] {
  return CONSTITUENCY_ZONES[normalize(constituency)] ?? [];
}

/**
 * Returns Title-Case display labels for the known zones of a constituency.
 * Used to populate the zone dropdown in the report modal.
 * Returns [] if the constituency has no zone map (caller should show free-text fallback).
 */
export function getZoneOptionsForConstituency(constituency: string | null | undefined): string[] {
  return CONSTITUENCY_ZONE_LABELS[normalize(constituency)] ?? [];
}

export function matchesConstituencyZone(
  constituency: string | null | undefined,
  zone: string | null | undefined
): boolean {
  const normalizedZone = normalize(zone);
  if (!normalizedZone) return false;

  const constituencyZones = getZonesForConstituency(constituency);
  if (constituencyZones.length > 0) {
    return constituencyZones.includes(normalizedZone);
  }

  return normalizedZone === normalize(constituency);
}
