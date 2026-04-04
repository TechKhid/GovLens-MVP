#!/usr/bin/env node
/**
 * scripts/geocode-constituencies.js
 *
 * One-time script that geocodes all Ghana constituency names using Nominatim
 * and writes the result to frontend/src/lib/constituency-centers.json.
 *
 * Usage:
 *   node scripts/geocode-constituencies.js
 *
 * Takes ~8–10 minutes (respects Nominatim's 1 req/s rate limit).
 * Commit the output file — no need to run this again unless constituencies change.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Paths ────────────────────────────────────────────────────────────────────

const CONSTITUENCIES_FILE = path.join(__dirname, '../backend/data/constituencies.json');
const REGIONS_FILE        = path.join(__dirname, '../backend/data/regions.json');
const OUTPUT_FILE         = path.join(__dirname, '../frontend/src/lib/constituency-centers.json');

// ── Region capital fallback coordinates ───────────────────────────────────────
// Used when a constituency name doesn't resolve in Nominatim.
// These are well-known capitals that Nominatim reliably returns.

const REGION_CAPITALS = {
    'ahafo-region':        { lat: 6.800,  lng: -2.517 },  // Goaso
    'ashanti-region':      { lat: 6.687,  lng: -1.624 },  // Kumasi
    'bono-region':         { lat: 7.340,  lng: -2.327 },  // Sunyani
    'bono-east-region':    { lat: 7.590,  lng: -1.940 },  // Techiman
    'central-region':      { lat: 5.117,  lng: -1.300 },  // Cape Coast
    'eastern-region':      { lat: 6.083,  lng: -0.267 },  // Koforidua
    'greater-accra-region':{ lat: 5.603,  lng: -0.187 },  // Accra
    'northern-region':     { lat: 9.400,  lng: -0.847 },  // Tamale
    'north-east-region':   { lat: 10.533, lng: -0.367 },  // Nalerigu
    'oti-region':          { lat: 8.067,  lng: 0.183  },  // Dambai
    'savannah-region':     { lat: 9.083,  lng: -1.817 },  // Damongo
    'upper-east-region':   { lat: 10.783, lng: -0.850 },  // Bolgatanga
    'upper-west-region':   { lat: 10.067, lng: -2.500 },  // Wa
    'volta-region':        { lat: 6.600,  lng: 0.467  },  // Ho
    'western-region':      { lat: 4.933,  lng: -1.717 },  // Sekondi-Takoradi
    'western-north-region':{ lat: 6.200,  lng: -2.483 },  // Sefwi Wiawso
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function nominatimGet(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'GovLens-MVP/1.0 (constituency-geocoder; one-time script)',
                'Accept': 'application/json',
            },
        };
        https.get(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

/**
 * Try multiple Nominatim query strategies for a constituency name.
 * Returns { lat, lng } or null.
 */
async function geocode(name) {
    const queries = [
        // Most specific first
        `${name} Constituency Ghana`,
        `${name} District Ghana`,
        `${name} Ghana`,
        // Strip parenthetical suffixes e.g. "Ablekuma North" from "Ablekuma North (part)"
        `${name.split('(')[0].trim()} Ghana`,
    ];

    for (const q of queries) {
        const encoded = encodeURIComponent(q);
        const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=3&countrycodes=gh&addressdetails=1`;

        try {
            const results = await nominatimGet(url);

            if (results && results.length > 0) {
                // Prefer results that are in Ghana (double-check) and have
                // a meaningful OSM type (administrative, boundary, place)
                const best = results.find(
                    (r) =>
                        r.address?.country_code === 'gh' &&
                        ['administrative', 'boundary', 'place', 'town', 'village', 'city'].includes(r.class)
                ) || results[0];

                if (best) {
                    return { lat: parseFloat(best.lat), lng: parseFloat(best.lon), source: `nominatim:${q}` };
                }
            }
        } catch (err) {
            console.error(`  Nominatim error for "${q}":`, err.message);
        }

        // Respect rate limit
        await sleep(1200);
    }

    return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const constituencies = JSON.parse(fs.readFileSync(CONSTITUENCIES_FILE, 'utf8'));

    console.log(`\nGeocoding ${constituencies.length} constituencies...`);
    console.log('This will take approximately', Math.ceil((constituencies.length * 1.2) / 60), 'minutes.\n');

    const output = {};
    let resolved = 0;
    let fallback = 0;
    let failed = 0;

    // Load existing results to allow resuming interrupted runs
    if (fs.existsSync(OUTPUT_FILE)) {
        const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        Object.assign(output, existing);
        console.log(`Resuming — ${Object.keys(existing).length} already geocoded.\n`);
    }

    for (let i = 0; i < constituencies.length; i++) {
        const { name, region_slug } = constituencies[i];

        // Skip already done
        if (output[name]) {
            resolved++;
            continue;
        }

        process.stdout.write(`[${i + 1}/${constituencies.length}] ${name}... `);

        const result = await geocode(name);

        if (result) {
            output[name] = { lat: result.lat, lng: result.lng };
            console.log(`✓ ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}  (${result.source})`);
            resolved++;
        } else {
            // Fall back to region capital
            const regionCoords = REGION_CAPITALS[region_slug];
            if (regionCoords) {
                output[name] = { lat: regionCoords.lat, lng: regionCoords.lng, isFallback: true };
                console.log(`⚠ Region fallback: ${regionCoords.lat}, ${regionCoords.lng}`);
                fallback++;
            } else {
                output[name] = { lat: 7.9465, lng: -1.0232, isFallback: true }; // Ghana center
                console.log('✗ Ghana center fallback');
                failed++;
            }
        }

        // Write partial results after every 10 entries so progress is saved
        if ((i + 1) % 10 === 0) {
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
            console.log(`  [Saved ${Object.keys(output).length} entries]\n`);
        }

        await sleep(1200); // Nominatim rate limit
    }

    // Final write
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

    console.log('\n── Done ──────────────────────────────────────────────────────');
    console.log(`✓ Resolved via Nominatim : ${resolved}`);
    console.log(`⚠ Region-capital fallback: ${fallback}`);
    console.log(`✗ Ghana-center fallback  : ${failed}`);
    console.log(`\nOutput written to: ${OUTPUT_FILE}`);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
