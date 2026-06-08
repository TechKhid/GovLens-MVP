import json
import os
import re
from difflib import SequenceMatcher

def clean_name(name):
    name = name.lower()
    name = re.sub(r'\b(municipal|municipality|district|metro|metropolitan|assembly|region)\b', '', name)
    name = re.sub(r'[^a-z0-9\s]', '', name)
    return ' '.join(name.split())

def similarity(a, b):
    return SequenceMatcher(None, clean_name(a), clean_name(b)).ratio()

def main():
    base_dir = r"c:\Users\User\GovLens_MVP\backend\data"
    
    with open(os.path.join(base_dir, "regions.json"), "r") as f:
        regions = json.load(f)
        
    with open(os.path.join(base_dir, "districts.json"), "r") as f:
        districts = json.load(f)
        
    with open(os.path.join(base_dir, "constituencies.json"), "r") as f:
        constituencies = json.load(f)

    # Group districts by region
    districts_by_region = {}
    for d in districts:
        reg = d["region_slug"]
        if reg not in districts_by_region:
            districts_by_region[reg] = []
        districts_by_region[reg].append(d)

    # Build a lookup for district name to slug in the same region
    district_slug_by_name = {}
    for d in districts:
        key = (d["region_slug"], clean_name(d["name"]))
        district_slug_by_name[key] = d["slug"]

    # Manual Overrides: (constituency_name, region_slug) -> district_slug
    overrides = {
        # Greater Accra Region
        ("Ayawaso West Wuogon", "greater-accra-region"): "ayawaso-west-municipal",
        ("Okaikwei South", "greater-accra-region"): "accra-metro",
        ("Okaikwei Central", "greater-accra-region"): "okaikwei-north-municipal",
        ("Ablekuma South", "greater-accra-region"): "accra-metro",
        ("Odododiodioo", "greater-accra-region"): "accra-metro",
        ("Sege", "greater-accra-region"): "ada-west-district",
        ("Ada", "greater-accra-region"): "ada-east-district",
        ("Bortianor Ngleshie Amanfro", "greater-accra-region"): "ga-south-municipal",
        ("Domeabra Obom", "greater-accra-region"): "ga-south-municipal",
        ("Anyaa Sowutuom", "greater-accra-region"): "ga-central-municipal",
        ("Trobu", "greater-accra-region"): "ga-west-municipal",
        ("Amasaman", "greater-accra-region"): "ga-west-municipal",
        ("Dome Kwabenya", "greater-accra-region"): "ga-east-municipal",
        ("Dadekotopon", "greater-accra-region"): "la-dade-kotopon-municipal",
        ("Korle Klottey", "greater-accra-region"): "korle-klottey-municipal",
        ("Krowor", "greater-accra-region"): "krowor-municipal",
        ("Ledzokuku", "greater-accra-region"): "ledzokuku-municipal",
        ("Tema East", "greater-accra-region"): "tema-metro",
        ("Tema Central", "greater-accra-region"): "tema-metro",
        ("Tema West", "greater-accra-region"): "tema-west-municipal",
        ("Kpone Katamanso", "greater-accra-region"): "kpone-katamanso-municipal",
        ("Ashaiman", "greater-accra-region"): "ashaiman-municipal",
        ("Adentan", "greater-accra-region"): "adenta-municipal",
        ("Shai Osudoku", "greater-accra-region"): "shai-osudoku-district",
        ("Ningo Prampram", "greater-accra-region"): "ningo-prampram-district",
        
        # Central Region
        ("Komenda Edina Eguafo Abrem", "central-region"): "komendaedinaeguafoabirem-municipal",
        ("Mfantseman", "central-region"): "mfantsiman-municipal",
        ("Ajumako Enyan Esiam", "central-region"): "ajumakoenyanessiam-district",
        ("Hemang Lower Denkyira", "central-region"): "twifohemanglower-denkyira-district",
        ("Cape Coast South", "central-region"): "cape-coast-metro",
        ("Cape Coast North", "central-region"): "cape-coast-metro",
        ("Abura Asebu Kwamankese", "central-region"): "aburaasebukwamankese-district",

        # Savannah Region
        ("Damongo", "savannah-region"): "west-gonja-municipal",
        ("Daboya Mankarigu", "savannah-region"): "north-gonja-district",
        ("Yapei Kusawgu", "savannah-region"): "central-gonja-district",
        ("Salaga South", "savannah-region"): "east-gonja-municipal",
        ("Salaga North", "savannah-region"): "north-east-gonja-district",
        
        # Western Region
        ("Evalue Ajomoro Gwira", "western-region"): "nzema-east-municipal",
        ("Essikadu Ketan", "western-region"): "sekondi-takoradi-metro",
        ("Kwesimintim", "western-region"): "effia-kwesimintsim-municipal",
        ("Takoradi", "western-region"): "sekondi-takoradi-metro",
        ("Sekondi", "western-region"): "sekondi-takoradi-metro",
        ("Prestea Huni Valley", "western-region"): "prestea-huni-valley-municipal",
        ("Tarkwa Nsuaem", "western-region"): "tarkwa-nsuaem-municipal",

        # Northern Region
        ("Bimbilla", "northern-region"): "nanumba-north-municipal",
        ("Wulensi", "northern-region"): "nanumba-south-district",
        ("Tamale South", "northern-region"): "tamale-metro",
        ("Tamale Central", "northern-region"): "tamale-metro",
        ("Tamale North", "northern-region"): "tamale-metro",

        # Oti Region
        ("Buem", "oti-region"): "jasikan-district",
        ("Akan", "oti-region"): "kadjebi-district",
        ("Guan", "oti-region"): "jasikan-district",

        # Eastern Region
        ("Akwatia", "eastern-region"): "denkyembour-district",
        ("Abetifi", "eastern-region"): "kwahu-east-district",
        ("Nkawkaw", "eastern-region"): "kwahu-west-municipal",
        ("Mpraeso", "eastern-region"): "kwahu-south-district",
        ("Kade", "eastern-region"): "kwaebibirem-municipal",
        ("Akim Oda", "eastern-region"): "birim-central-municipal",
        ("Akim Swedru", "eastern-region"): "birim-south-district",
        ("Ofoase Ayirebi", "eastern-region"): "akyemansa-district",
        ("Asene Akroso Manso", "eastern-region"): "asene-manso-akroso-district",
        ("Akropong", "eastern-region"): "akuapim-north-municipal",

        # North East Region
        ("Walewale", "north-east-region"): "west-mamprusi-municipal",
        ("Yagaba Kubori", "north-east-region"): "mamprugu-moagduri-district",
        ("Nalerigu Gambaga", "north-east-region"): "east-mamprusi-municipal",
        ("Bunkpurugu", "north-east-region"): "bunkpurugu-nyankpanduri-district",
        ("Yunyoo", "north-east-region"): "yunyoo-nasuan-district",

        # Upper West Region
        ("Wa Central", "upper-west-region"): "wa-municipal",
        ("Wa West", "upper-west-region"): "wa-west-district",
        ("Wa East", "upper-west-region"): "wa-east-district",
        ("Nadowli Kaleo", "upper-west-region"): "nadowli-kaleo-district",

        # Upper East Region
        ("Kassena Nankana East", "upper-east-region"): "kassena-nankana-municipal",
        ("Kassena Nankana West", "upper-east-region"): "kassena-nankana-west-district",
        ("Bolgatanga Central", "upper-east-region"): "bolgatanga-municipal",
        ("Bolgatanga East", "upper-east-region"): "bolgatanga-east-district",
        ("Bawku Central", "upper-east-region"): "bawku-municipal",

        # Ashanti Region
        ("Asawase", "ashanti-region"): "asokore-mampong-municipal",
        ("New Edubiase", "ashanti-region"): "adansi-south-district",
        ("Subin", "ashanti-region"): "kumasi-metro",
        ("Tepa", "ashanti-region"): "ahafo-ano-north-municipal",
        ("Bantama", "ashanti-region"): "kumasi-metro",
        ("Nhyiaeso", "ashanti-region"): "kumasi-metro",
        ("Oforikrom", "ashanti-region"): "oforikrom-municipal",
        ("Suame", "ashanti-region"): "suame-municipal",
        ("Manhyia North", "ashanti-region"): "kumasi-metro",
        ("Manhyia South", "ashanti-region"): "kumasi-metro",
        ("Suame", "ashanti-region"): "suame-municipal",
        ("Tafo Pankrono", "ashanti-region"): "old-tafo-municipal",
        ("Kwabre East", "ashanti-region"): "kwabre-east-municipal",
        ("Juaben", "ashanti-region"): "juaben-municipal",
        ("Ejisu", "ashanti-region"): "ejisu-municipal",
        ("Kumawu", "ashanti-region"): "sekyere-kumawu-district",
        ("Bekwai", "ashanti-region"): "bekwai-municipal",
        ("Bosomtwe", "ashanti-region"): "bosomtwe-district",
        ("Bosome Freho", "ashanti-region"): "bosome-freho-district",
        ("Bosome-Freho", "ashanti-region"): "bosome-freho-district",
        ("Odotobri", "ashanti-region"): "amansie-central-district",
        ("Manso Nkwanta", "ashanti-region"): "amansie-west-district",
        ("Manso Adubia", "ashanti-region"): "amansie-south-district",
        ("Atwima Nwabiagya South", "ashanti-region"): "atwima-nwabiagya-municipal",

        # Volta Region
        ("Ho Central", "volta-region"): "ho-municipal",
        ("Ho West", "volta-region"): "ho-west-district",
        ("Adaklu", "volta-region"): "adaklu-district",
        ("Agotime Ziope", "volta-region"): "agotime-ziope-district",
        ("Kpetoe", "volta-region"): "agotime-ziope-district",
        ("Keta", "volta-region"): "keta-municipal",
        ("Anlo", "volta-region"): "anloga-district",
        ("Ketu South", "volta-region"): "ketu-south-municipal",
        ("Ketu North", "volta-region"): "ketu-north-municipal",
        ("Akatsi South", "volta-region"): "akatsi-south-district",
        ("Akatsi North", "volta-region"): "akatsi-north-district",
        ("South Tongu", "volta-region"): "south-tongu-district",
        ("Central Tongu", "volta-region"): "central-tongu-district",
        ("North Tongu", "volta-region"): "north-tongu-district",
        ("South Dayi", "volta-region"): "south-dayi-district",
        ("North Dayi", "volta-region"): "north-dayi-district",
        ("Kpando", "volta-region"): "kpando-municipal",
        ("Hohoe", "volta-region"): "hohoe-municipal",
        ("Afadjato South", "volta-region"): "afadzato-south-district",
        
        # Western North Region
        ("Bibiani Anhwiaso Bekwai", "western-north-region"): "bibiani-anhwiaso-bekwai-municipal",
        ("Sefwi Wiawso", "western-north-region"): "sefwi-wiawso-municipal",
        ("Sefwi Akontombra", "western-north-region"): "sefwi-akontombra-district",
        ("Bodi", "western-north-region"): "bodi-district",
        ("Juaboso", "western-north-region"): "juaboso-district",
        ("Bia West", "western-north-region"): "bia-west-district",
        ("Bia East", "western-north-region"): "bia-east-district",
        ("Suaman", "western-north-region"): "suaman-district",
    }

    modified_count = 0
    unresolved_count = 0

    for c in constituencies:
        c_name = c["name"]
        reg_slug = c["region_slug"]
        
        # 1. Check manual override first
        override_key = (c_name, reg_slug)
        if override_key in overrides:
            target_district_slug = overrides[override_key]
            if c.get("district_slug") != target_district_slug:
                c["district_slug"] = target_district_slug
                modified_count += 1
            continue

        # 2. Fuzzy match in region if not specified
        if "district_slug" not in c or not c["district_slug"]:
            candidates = districts_by_region.get(reg_slug, [])
            best_candidate = None
            best_score = 0.0
            
            for d in candidates:
                score = similarity(c_name, d["name"])
                if score > best_score:
                    best_score = score
                    best_candidate = d
                    
            if best_candidate and best_score >= 0.5:
                c["district_slug"] = best_candidate["slug"]
                modified_count += 1
            else:
                unresolved_count += 1
                print(f"WARN: Could not automatically resolve district for {c_name} ({reg_slug})")

    # Save modified constituencies
    with open(os.path.join(base_dir, "constituencies.json"), "w") as f:
        json.dump(constituencies, f, indent=2)

    print(f"Done! Modified: {modified_count}, Unresolved: {unresolved_count}")

if __name__ == "__main__":
    main()
