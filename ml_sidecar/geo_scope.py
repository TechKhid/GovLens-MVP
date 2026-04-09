CONSTITUENCY_ZONES: dict[str, set[str]] = {
    "ayawaso west wuogon": {
        "dzorwulu",
        "abelemkpe",
        "east legon",
        "airport residential",
        "okponglo",
        "roman ridge",
    }
}


def _normalize(value: str | None) -> str:
    return (value or "").strip().lower()


def zone_matches_scope(record_zone: str | None, scope: str | None) -> bool:
    normalized_scope = _normalize(scope)
    if not normalized_scope:
        return True

    normalized_zone = _normalize(record_zone)
    if not normalized_zone:
        return False

    constituency_zones = CONSTITUENCY_ZONES.get(normalized_scope)
    if constituency_zones:
        return normalized_zone in constituency_zones

    return normalized_zone == normalized_scope

