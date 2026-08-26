export class CurrencyService {
    private ratesCache: Record<string, number> = {};
    private lastFetchTime: Record<string, number> = {};
    private readonly CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 jam cache

    /**
     * Dapatkan nilai tukar mata uang asal ke mata uang tujuan.
     */
    async getExchangeRate(fromCurrency: string, toCurrency: string = 'IDR'): Promise<number> {
        fromCurrency = fromCurrency.toUpperCase();
        toCurrency = toCurrency.toUpperCase();

        if (fromCurrency === toCurrency) return 1;

        const cacheKey = `${fromCurrency}_${toCurrency}`;
        const now = Date.now();

        // 1. Cek dari cache
        if (this.ratesCache[cacheKey] && this.lastFetchTime[cacheKey]) {
            if (now - this.lastFetchTime[cacheKey] < this.CACHE_DURATION_MS) {
                return this.ratesCache[cacheKey];
            }
        }

        // 2. Fetch API terbaru dari exchangerate-api.com (free, no auth)
        try {
            console.log(`💱 Fetching exchange rate for ${fromCurrency}...`);
            const response = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`);
            
            if (!response.ok) {
                throw new Error(`Gagal memanggil API: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data?.rates && data.rates[toCurrency]) {
                const rate = data.rates[toCurrency];
                
                // Simpan ke cache
                this.ratesCache[cacheKey] = rate;
                this.lastFetchTime[cacheKey] = now;
                
                return rate;
            } else {
                throw new Error(`Rate untuk ${toCurrency} tidak ditemukan.`);
            }
        } catch (error) {
            console.error("Error fetching exchange rate:", error);
            
            // Fallback ke cache jika ada cache basi
            if (this.ratesCache[cacheKey]) {
                console.warn("⚠️ Menggunakan cache yang sudah kedaluwarsa.");
                return this.ratesCache[cacheKey];
            }
            
            // Hardcode fallback sementara untuk USD -> IDR agar bot tetap jalan jika API down
            if (fromCurrency === 'USD' && toCurrency === 'IDR') {
                return 16000; 
            }
            if (fromCurrency === 'IDR' && toCurrency === 'USD') {
                return 1 / 16000;
            }

            throw new Error(`Gagal mengonversi ${fromCurrency} ke ${toCurrency}`);
        }
    }

    /**
     * Konversi nilai uang.
     */
    async convert(amount: number, fromCurrency: string, toCurrency: string = 'IDR'): Promise<number> {
        const rate = await this.getExchangeRate(fromCurrency, toCurrency);
        return Math.round(amount * rate);
    }
}

export const currencyService = new CurrencyService();
