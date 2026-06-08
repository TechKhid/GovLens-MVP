package api

import "strings"

var constituencyZones = map[string][]string{
	// ── Greater Accra ─────────────────────────────────────────────────────────
	"ayawaso west wuogon": {
		"dzorwulu", "abelemkpe", "airport residential", "okponglo",
		"roman ridge", "east legon",
	},
	"ayawaso central": {
		"asylum down", "north labone", "south labone", "ridge",
		"cantonments", "osu",
	},
	"ayawaso east":  {"adenta", "pantang", "abokobi", "dome", "kwabenya"},
	"ayawaso north": {"achimota", "ofankor", "pokuase", "amasaman"},
	"okaikwei north": {
		"abossey okai", "alajo", "nima", "maamobi", "accra new town",
	},
	"okaikwei south":  {"kaneshie", "mataheko", "gbegbeyise", "kokompe"},
	"ablekuma north":  {"dansoman", "mamprobi", "bubuashie", "odorkor"},
	"ablekuma central": {"kwashieman", "awoshie", "tetegu"},
	"ablekuma west":   {"gbawe", "weija", "oblogo", "kasoa north"},
	"la-dade-kotopon": {"la", "labadi", "teshie", "nungua"},
	"krowor":          {"nungua", "baatsona", "sakumono", "community 18"},
	"ledzokuku":       {"teshie", "east legon hills", "community 25"},
	"korle-klottey":   {"jamestown", "ussher town", "sempe", "chorkor", "mamprobi south"},
	"klottey korle":   {"jamestown", "ussher town", "sempe"},
	"ga central":      {"amasaman", "pokuase", "sowutuom", "chantan"},
	"ga east":         {"haatso", "agbogba", "madina", "oyibi"},
	"ga north":        {"pokuase", "amasaman", "nsawam"},
	"ga south":        {"weija", "gbawe", "kokrobite", "kasoa"},
	"ga west":         {"accra hills", "amasaman", "ablekuma"},
	"tema west":       {"community 1", "community 2", "community 3", "ashaiman"},
	"tema central":    {"community 4", "community 5", "community 6", "manhean"},
	"tema east":       {"dawhenya", "afienya", "prampram"},
	"adenta":          {"adenta", "frafraha", "oyarifa"},
	"ashaiman":        {"ashaiman", "tulako", "nii kpakpa"},
	"kpone-katamanso": {"kpone", "katamanso", "devtraco", "community 20"},
	"ningo-prampram":  {"prampram", "ningo", "dawhenya", "aveyime"},
	"shai-osudoku":    {"dodowa", "osudoku", "akuse"},
	"ada east":        {"ada foah", "kasseh", "totope"},
	"ada west":        {"sege", "battor", "mepe"},
	"north tongu":     {"adidome", "battor", "juapong"},
	"weija-gbawe":     {"weija", "gbawe", "kasoa", "bortianor"},
	// ── Ashanti ───────────────────────────────────────────────────────────────
	"kumasi central": {"adum", "manhyia", "bantama", "subin"},
	"bantama":        {"bantama", "nhyiaeso", "suame"},
	"suame":          {"suame", "magazine", "ahensan"},
	"asokwa":         {"asokwa", "kaase", "atonsu"},
	"oforikrom":      {"oforikrom", "kentinkrono", "emena"},
	"tafo":           {"tafo", "pankrono", "buokrom"},
	"nhyiaeso":       {"nhyiaeso", "fante new town", "asawase"},
	"kwadaso":        {"kwadaso", "kodie", "abuakwa"},
	"old tafo":       {"old tafo", "new tafo", "buokrom"},
	// ── Central Region ────────────────────────────────────────────────────────
	"cape coast north": {"abura", "eguafo", "abirem", "pedu"},
	"cape coast south": {"cape coast", "moree", "bakaano", "kotokuraba"},
	// ── Western Region ────────────────────────────────────────────────────────
	"sekondi":  {"sekondi", "takoradi", "market circle", "effiakuma"},
	"takoradi": {"takoradi", "harbour area", "anaji"},
	// ── Northern Region ───────────────────────────────────────────────────────
	"tamale central": {"tamale", "lamashegu", "choggu"},
	"tamale north":   {"tamale north", "vitin", "changli"},
	"tamale south":   {"tamale south", "gurugu"},
	// ── Eastern Region ────────────────────────────────────────────────────────
	"koforidua": {"koforidua", "effiduase", "new juaben"},
}


func normalizeScope(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func zonesForConstituency(constituency string) []string {
	return constituencyZones[normalizeScope(constituency)]
}

func zoneMatchesConstituency(constituency string, zone *string) bool {
	if zone == nil {
		return false
	}

	normalizedZone := normalizeScope(*zone)
	if normalizedZone == "" {
		return false
	}

	if allowedZones := zonesForConstituency(constituency); len(allowedZones) > 0 {
		for _, allowedZone := range allowedZones {
			if normalizedZone == allowedZone {
				return true
			}
		}
		return false
	}

	return normalizedZone == normalizeScope(constituency)
}

