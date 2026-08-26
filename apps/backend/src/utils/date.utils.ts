/**
 * Memastikan ISO string date memiliki offset timezone (+07:00 jika WIB dan tidak ada offset)
 */
export const normalizeIsoDate = (dateStr?: string | null): string | null => {
    if (!dateStr) return null;
    let trimmed = dateStr.trim();

    // Jika hanya YYYY-MM-DD (misal: "2026-08-25")
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        trimmed = `${trimmed}T23:59:59`;
    }

    // Jika belum ada offset timezone (Z, +HH:MM, -HH:MM, +HHMM, -HHMM)
    if (!/[Zz]|\+[0-9]{2}:?[0-9]{2}$|\-[0-9]{2}:?[0-9]{2}$/.test(trimmed)) {
        return `${trimmed}+07:00`;
    }
    return trimmed;
};
