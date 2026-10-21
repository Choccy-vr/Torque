// IANA timezones for the streak day (backend: api/user/me/timezone). The
// browser already knows the device's zone, so nothing asks for location.

export function detectTimeZone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
        return 'UTC'
    }
}

// Every zone the browser knows, grouped by region ("America", "Europe", …),
// each region and its zones sorted. Always includes `extra` (the detected one).
export function timeZonesByRegion(extra) {
    let zones = []
    try {
        zones = Intl.supportedValuesOf('timeZone')
    } catch {
        // Older browsers: the detected zone and UTC are still choosable.
    }
    const all = [...new Set([...zones, extra, 'UTC'].filter(Boolean))]

    const groups = new Map()
    for (const id of all) {
        const region = id.includes('/') ? id.split('/')[0] : 'Other'
        if (!groups.has(region)) groups.set(region, [])
        groups.get(region).push(id)
    }
    return [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([region, ids]) => [region, ids.sort((a, b) => cityOf(a).localeCompare(cityOf(b)))])
}

// "America/Argentina/Buenos_Aires" -> "Buenos Aires"
export function cityOf(id) {
    return id.split('/').pop().replaceAll('_', ' ')
}

// "America/Argentina/Buenos_Aires" -> "America · Argentina"
export function regionOf(id) {
    const parts = id.split('/').slice(0, -1)
    return parts.length ? parts.map((p) => p.replaceAll('_', ' ')).join(' · ') : null
}

// "UTC−4", "UTC+5:30", "UTC"
export function offsetOf(id, date = new Date()) {
    try {
        const name = new Intl.DateTimeFormat('en-US', { timeZone: id, timeZoneName: 'shortOffset' })
            .formatToParts(date)
            .find((p) => p.type === 'timeZoneName')?.value ?? ''
        return name.replace('GMT', 'UTC').replace('-', '−')
    } catch {
        return ''
    }
}

// The time right now in that zone, e.g. "9:41 PM"
export function timeIn(id, date = new Date()) {
    try {
        return date.toLocaleTimeString(undefined, { timeZone: id, hour: 'numeric', minute: '2-digit' })
    } catch {
        return ''
    }
}
