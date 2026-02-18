/**
 * Scryfall API integration for enriching card data
 */

const SCRYFALL_API = 'https://api.scryfall.com'

// Set code aliases: some sources (e.g. ManaBox) use different codes than Scryfall
const SET_CODE_ALIASES = {
  eoc: 'eoe' // Edge of Eternities: EOC (common typo/alt) -> EOE (Scryfall)
}

export class ScryfallEnricher {
  constructor() {
    this.cache = new Map()
    this.requestQueue = []
    this.processing = false
  }

  /** Resolve set code to Scryfall's code (lowercase), using aliases if needed */
  resolveSetCode(setCode) {
    const code = (setCode || '').toLowerCase().trim()
    return SET_CODE_ALIASES[code] || code
  }

  /**
   * Enrich a card row with Scryfall data
   */
  async enrichCard(cardRow) {
    const cacheKey = `${cardRow.setCode}-${cardRow.collectorNumber}-${cardRow.finish}`
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)
      return this.applyEnrichment(cardRow, cached)
    }

    try {
      // 1. Try direct lookup by set code + collector number
      let card = await this.getCardBySetAndNumber(cardRow.setCode, cardRow.collectorNumber)

      // 1b. Retry with zero-padded collector number (e.g. 8 -> 008) if numeric and first try failed
      if (!card && cardRow.collectorNumber && /^\d+$/.test(String(cardRow.collectorNumber).trim())) {
        const padded = String(cardRow.collectorNumber).trim().padStart(3, '0')
        if (padded !== String(cardRow.collectorNumber).trim()) {
          await new Promise((r) => setTimeout(r, 100))
          card = await this.getCardBySetAndNumber(cardRow.setCode, padded)
        }
      }

      // 2. Fallback: search by exact card name + set
      if (!card && cardRow.name && cardRow.setCode) {
        await new Promise((r) => setTimeout(r, 120))
        card = await this.getCardByNameAndSet(cardRow.name, cardRow.setCode)
        if (card) {
          console.info('Scryfall fallback (name+set):', cardRow.name, 'set:', cardRow.setCode)
        }
      }

      // 3. Last resort: exact name only (may be different printing; we still get price/set)
      if (!card && cardRow.name) {
        await new Promise((r) => setTimeout(r, 120))
        card = await this.getCardByNameOnly(cardRow.name)
        if (card) {
          cardRow.addWarning('Matched by name only (printing may differ)')
          console.info('Scryfall fallback (name only):', cardRow.name)
        }
      }

      if (!card) {
        cardRow.addWarning('Card not found in Scryfall')
        this.cache.set(cacheKey, null)
        return cardRow
      }

      const enrichment = {
        marketPrice: this.getMarketPrice(card, cardRow.finish),
        setName: card.set_name || '',
        ckEdition: this.mapToCardKingdomEdition(card),
        scryfallData: card
      }

      this.cache.set(cacheKey, enrichment)
      return this.applyEnrichment(cardRow, enrichment)
    } catch (error) {
      console.error('Scryfall enrichment error:', error)
      cardRow.addWarning('Error fetching price data')
      return cardRow
    }
  }

  /**
   * Get card by set code and collector number
   * Scryfall expects lowercase set codes in the URL (e.g. m21, not M21)
   */
  async getCardBySetAndNumber(setCode, collectorNumber) {
    try {
      const code = this.resolveSetCode(setCode)
      // Collector number as-is (can include letters, e.g. "27s")
      const number = encodeURIComponent(String(collectorNumber || '').trim())

      if (!code || !number) {
        console.warn('Scryfall lookup: missing setCode or collectorNumber', {
          setCode,
          collectorNumber
        })
        return null
      }

      const url = `${SCRYFALL_API}/cards/${code}/${number}`
      const response = await fetch(url)

      if (!response.ok) {
        // Log failed lookups to help debug "not found" issues
        console.warn('Scryfall lookup failed', {
          url,
          status: response.status,
          setCode: code,
          collectorNumber: decodeURIComponent(number)
        })
        return null
      }

      return await response.json()
    } catch (error) {
      console.error('Scryfall API error:', error)
      return null
    }
  }

  /**
   * Fallback: get card by exact name and set code (for when set+number lookup fails)
   * Uses Scryfall /cards/named?exact=...&set=...
   */
  async getCardByNameAndSet(cardName, setCode) {
    try {
      const code = this.resolveSetCode(setCode)
      const name = (cardName || '').trim()
      if (!name || !code) return null

      const url = `${SCRYFALL_API}/cards/named?exact=${encodeURIComponent(name)}&set=${encodeURIComponent(code)}`
      const response = await fetch(url)

      if (!response.ok) {
        return null
      }

      return await response.json()
    } catch (error) {
      return null
    }
  }

  /**
   * Last-resort fallback: get card by exact name only (no set).
   * Returns one printing; may not match requested set but provides price/set name.
   */
  async getCardByNameOnly(cardName) {
    try {
      const name = (cardName || '').trim()
      if (!name) return null

      const url = `${SCRYFALL_API}/cards/named?exact=${encodeURIComponent(name)}`
      const response = await fetch(url)

      if (!response.ok) {
        return null
      }

      return await response.json()
    } catch (error) {
      return null
    }
  }

  /**
   * Get market price for a card based on finish
   */
  getMarketPrice(card, finish) {
    if (finish === 'foil') {
      return card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : 0
    } else {
      return card.prices?.usd ? parseFloat(card.prices.usd) : 0
    }
  }

  /**
   * Map Scryfall set name to Card Kingdom edition name
   * This is a simplified mapping - may need expansion
   */
  mapToCardKingdomEdition(card) {
    const setName = card.set_name || ''
    
    // Card Kingdom typically uses the full set name
    // Some sets may need special mapping, but for MVP we'll use the set name
    // Common mappings can be added here as needed
    const specialMappings = {
      'The Brothers\' War': 'The Brothers\' War',
      'Phyrexia: All Will Be One': 'Phyrexia: All Will Be One',
      'March of the Machine': 'March of the Machine',
      'The Lord of the Rings: Tales of Middle-earth': 'The Lord of the Rings: Tales of Middle-earth'
    }

    let edition = specialMappings[setName] || setName
    
    // If the last word in the set name is "Commander", add " Decks" to the end
    const words = edition.trim().split(/\s+/)
    if (words.length > 0 && words[words.length - 1].toLowerCase() === 'commander') {
      edition = edition + ' Decks'
    }

    return edition
  }

  /**
   * Apply enrichment data to a card row
   */
  applyEnrichment(cardRow, enrichment) {
    if (!enrichment) {
      return cardRow
    }

    cardRow.marketPrice = enrichment.marketPrice || 0
    cardRow.setName = enrichment.setName || ''
    cardRow.ckEdition = enrichment.ckEdition || enrichment.setName || ''

    if (cardRow.marketPrice === 0) {
      cardRow.addWarning('No price data available')
    }

    return cardRow
  }

  /**
   * Enrich multiple cards with rate limiting
   */
  async enrichCards(cardRows, onProgress) {
    const total = cardRows.length
    let processed = 0

    // Process in batches to avoid overwhelming the API
    const batchSize = 10
    const delay = 100 // ms between batches

    for (let i = 0; i < cardRows.length; i += batchSize) {
      const batch = cardRows.slice(i, i + batchSize)
      
      await Promise.all(
        batch.map(async (cardRow) => {
          await this.enrichCard(cardRow)
          processed++
          if (onProgress) {
            onProgress(processed, total)
          }
        })
      )

      // Rate limiting delay between batches
      if (i + batchSize < cardRows.length) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    return cardRows
  }
}

export const scryfallEnricher = new ScryfallEnricher()
