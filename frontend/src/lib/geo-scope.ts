const CONSTITUENCY_ZONES: Record<string, string[]> = {
  "ayawaso west wuogon": [
    "dzorwulu",
    "abelemkpe",
    "east legon",
    "airport residential",
    "okponglo",
    "roman ridge",
  ],
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function getZonesForConstituency(constituency: string | null | undefined): string[] {
  return CONSTITUENCY_ZONES[normalize(constituency)] ?? [];
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

