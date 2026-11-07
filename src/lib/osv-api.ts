import semver from 'semver';

export interface OSVVulnerability {
    id: string;
    summary?: string;
    details?: string;
    modified: string;
    published: string;
    aliases?: string[];
    affected: {
        package: {
            ecosystem: string;
            name: string;
        };
        ranges?: {
            type: string;
            events: {
                introduced?: string;
                fixed?: string;
                last_affected?: string;
            }[];
        }[];
        versions?: string[];
        database_specific?: {
            cvss?: {
                score?: number;
                severity?: string;
            };
        };
    }[];
    references?: { type: string; url: string }[];
    database_specific?: {
        severity?: string;
        [key: string]: any;
    };
    severity?: {
        type: string;
        score: string;
    }[];
}

export interface N8nVulnerabilityRecord {
    id: string;
    cve?: string;
    summary: string;
    details: string;
    severity: string;
    published: string;
    url?: string;
    affectedVersions: string; // User-friendly range display (e.g., ">=0.1.0 <1.5.0")
    fixedIn?: string;
}

export async function fetchN8nAdvisories(): Promise<OSVVulnerability[]> {
    try {
        const packages = ['n8n', 'n8n-nodes-base', 'n8n-core'];

        // 1. Fetch from OSV Database
        const osvPromises = packages.map(pkg =>
            fetch('https://api.osv.dev/v1/query', {
                method: 'POST',
                body: JSON.stringify({
                    package: {
                        name: pkg,
                        ecosystem: 'npm'
                    }
                }),
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store' // Bypass cache completely
            }).then(res => res.ok ? res.json() : { vulns: [] })
        );

        // 2. Fetch directly from GitHub to catch 0-days before they sync to OSV
        // Example: GHSA-f3f2-mcxc-pwjx
        const githubPromise = fetch('https://api.github.com/repos/n8n-io/n8n/security-advisories', {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                // Add a generic user agent as required by GitHub API
                'User-Agent': 'Wisely-Security-Scanner'
            },
            cache: 'no-store' // Bypass cache completely
        }).then(res => res.ok ? res.json() : []);

        const [osvResults, githubResults] = await Promise.all([
            Promise.all(osvPromises),
            githubPromise
        ]);

        const allVulns: OSVVulnerability[] = [];
        const seenIds = new Set<string>();

        // Process OSV Results
        for (const data of osvResults) {
            if (data && data.vulns && Array.isArray(data.vulns)) {
                for (const vuln of data.vulns) {
                    if (!seenIds.has(vuln.id)) {
                        seenIds.add(vuln.id);
                        allVulns.push(vuln);
                    }
                }
            }
        }

        // Process GitHub Results and map them to OSV schema
        if (Array.isArray(githubResults)) {
            for (const ghsa of githubResults) {
                if (ghsa.ghsa_id && !seenIds.has(ghsa.ghsa_id)) {
                    seenIds.add(ghsa.ghsa_id);

                    // Simple conversion from GitHub Advisory to OSV format
                    const convertedVuln: OSVVulnerability = {
                        id: ghsa.ghsa_id,
                        summary: ghsa.summary,
                        details: ghsa.description,
                        published: ghsa.published_at,
                        modified: ghsa.updated_at,
                        aliases: ghsa.cve_id ? [ghsa.cve_id] : [],
                        affected: ghsa.vulnerabilities?.map((v: any) => {
                            let fixedVersion: string | undefined;
                            let introducedVersion: string | undefined;

                            // Attempt to parse fixed version from patched_versions or vulnerable_version_range
                            if (v.patched_versions && v.patched_versions !== '>= 0') {
                                // Example: ">= 2.4.0" -> "2.4.0"
                                // Example: "< 2.4.0" -> "2.4.0" (this is a bit of an approximation, but common)
                                const match = v.patched_versions.match(/(\d+\.\d+\.\d+)/);
                                if (match) {
                                    fixedVersion = match[1];
                                }
                            } else if (v.vulnerable_version_range) {
                                // Example: "< 2.4.0" -> "2.4.0"
                                // Example: ">= 1.0.0, < 2.0.0" -> "2.0.0"
                                const fixedMatch = v.vulnerable_version_range.match(/< (\d+\.\d+\.\d+)/);
                                if (fixedMatch) {
                                    fixedVersion = fixedMatch[1];
                                }
                                const introducedMatch = v.vulnerable_version_range.match(/>= (\d+\.\d+\.\d+)/);
                                if (introducedMatch) {
                                    introducedVersion = introducedMatch[1];
                                }
                            }

                            return {
                                package: {
                                    ecosystem: v.package?.ecosystem || 'npm',
                                    name: v.package?.name || 'n8n'
                                },
                                ranges: [{
                                    type: 'SEMVER',
                                    events: [
                                        { introduced: introducedVersion || '0.0.0' },
                                        ...(fixedVersion ? [{ fixed: fixedVersion }] : [])
                                    ]
                                }]
                            };
                        }) || [],
                        database_specific: {
                            severity: ghsa.severity?.toUpperCase() || 'UNKNOWN'
                        },
                        references: ghsa.html_url ? [{ type: 'ADVISORY', url: ghsa.html_url }] : []
                    };

                    allVulns.push(convertedVuln);
                }
            }
        }

        // Sort by published date descending, fallback to modified date, then 0.
        allVulns.sort((a, b) => {
            const timeA = new Date(a.published || a.modified || 0).getTime();
            const timeB = new Date(b.published || b.modified || 0).getTime();
            // Handle NaN
            const validA = isNaN(timeA) ? 0 : timeA;
            const validB = isNaN(timeB) ? 0 : timeB;
            return validB - validA;
        });

        return allVulns;
    } catch (error) {
        console.error('Failed to fetch hybrid advisories:', error);
        return [];
    }
}

/**
 * Parses OSV ranges into a clean readable string and checks if a specific version is vulnerable
 */
export function isVersionVulnerable(version: string, vuln: OSVVulnerability): { vulnerable: boolean; rangeDisplay: string; fixedIn?: string } {
    if (!semver.valid(version)) {
        // If we can't parse the version, assume safe to avoid false positives, or just return false
        return { vulnerable: false, rangeDisplay: 'Unknown' };
    }

    let isVulnerable = false;
    let rangeDisplayParts: string[] = [];
    let fixedInVersion: string | undefined;

    for (const affected of vuln.affected || []) {
        if (affected.versions && affected.versions.includes(version)) {
            isVulnerable = true;
        }

        for (const range of affected.ranges || []) {
            if (range.type === 'SEMVER' || range.type === 'ECOSYSTEM') {
                let introduced = '0.0.0';
                let fixed: string | undefined;

                for (const event of range.events) {
                    if (event.introduced) introduced = event.introduced === '0' ? '0.0.0' : event.introduced;
                    if (event.fixed) fixed = event.fixed;
                    if (event.last_affected) fixed = semver.inc(event.last_affected, 'patch') || undefined; // Approximation
                }

                // Building the semver range string
                let rangeStr = `>=${introduced}`;
                if (fixed) {
                    rangeStr += ` <${fixed}`;
                    fixedInVersion = fixed;
                }
                rangeDisplayParts.push(rangeStr);

                // Check if our version falls in this range
                if (semver.satisfies(version, rangeStr)) {
                    isVulnerable = true;
                }
            }
        }
    }

    return {
        vulnerable: isVulnerable,
        rangeDisplay: rangeDisplayParts.length > 0 ? rangeDisplayParts.join(' OR ') : (vuln.affected?.[0]?.versions?.join(', ') || 'Unknown'),
        fixedIn: fixedInVersion
    };
}

export function parseVulnerability(vuln: OSVVulnerability): N8nVulnerabilityRecord {
    // Attempt to extract CVE for primary display
    const cve = vuln.aliases?.find(a => a.startsWith('CVE-'));

    // Find severity (usually in database_specific at root)
    let severity = 'UNKNOWN';
    if (vuln.database_specific && vuln.database_specific.severity) {
        severity = vuln.database_specific.severity.toUpperCase();
    } else {
        // Simple heuristics from aliases or summary if missing
        if (vuln.aliases?.some(a => a.startsWith('GHSA-'))) severity = 'MEDIUM';
    }

    // Map GitHub's 'MODERATE' to our 'MEDIUM' terminology
    if (severity === 'MODERATE') severity = 'MEDIUM';

    // Build range display (ignoring specific version check here)
    const { rangeDisplay, fixedIn } = isVersionVulnerable('0.0.0', vuln);

    return {
        id: vuln.id,
        cve: cve,
        summary: vuln.summary || 'No summary available',
        details: vuln.details || '',
        severity: severity.toUpperCase(),
        published: vuln.published,
        url: vuln.references?.find(r => r.type === 'ADVISORY' || r.type === 'WEB')?.url || `https://osv.dev/vulnerability/${vuln.id}`,
        affectedVersions: rangeDisplay,
        fixedIn
    };
}
