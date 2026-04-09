package api

import "strings"

var constituencyZones = map[string][]string{
	"ayawaso west wuogon": {
		"dzorwulu",
		"abelemkpe",
		"east legon",
		"airport residential",
		"okponglo",
		"roman ridge",
	},
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

