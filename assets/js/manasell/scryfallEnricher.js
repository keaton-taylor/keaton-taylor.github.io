/**
 * Scryfall API integration for enriching card data
 */

const SCRYFALL_API = 'https://api.scryfall.com'

export class ScryfallEnricher {
  constructor() {
    this.cache = new Map()
    this.requestQueue = []
    this.processing = false
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
      // Search by set code and collector number
      const card = await this.getCardBySetAndNumber(cardRow.setCode, cardRow.collectorNumber)
      
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
   */
  async getCardBySetAndNumber(setCode, collectorNumber) {
    try {
      const url = `${SCRYFALL_API}/cards/${setCode}/${collectorNumber}`
      const response = await fetch(url)
      
      if (!response.ok) {
        return null
      }

      return await response.json()
    } catch (error) {
      console.error('Scryfall API error:', error)
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

    return specialMappings[setName] || setName
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
