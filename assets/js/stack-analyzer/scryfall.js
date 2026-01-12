/**
 * Scryfall API integration
 */

const SCRYFALL_API = 'https://api.scryfall.com'

export class ScryfallService {
  constructor() {
    this.cache = new Map()
    this.debounceTimer = null
  }

  async searchCards(query, limit = 10) {
    if (!query || query.length < 2) {
      return []
    }

    // Check cache
    const cacheKey = `search:${query}:${limit}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const url = `${SCRYFALL_API}/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=released&dir=desc&limit=${limit}`
      const response = await fetch(url)
      
      if (!response.ok) {
        if (response.status === 404) {
          return []
        }
        throw new Error(`Scryfall API error: ${response.status}`)
      }

      const data = await response.json()
      const cards = data.data || []
      
      // Cache results
      this.cache.set(cacheKey, cards)
      
      return cards
    } catch (error) {
      console.error('Scryfall search error:', error)
      return []
    }
  }

  async getCardByName(name, fuzzy = true) {
    const cacheKey = `card:${name}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const url = `${SCRYFALL_API}/cards/named?${fuzzy ? 'fuzzy' : 'exact'}=${encodeURIComponent(name)}`
      const response = await fetch(url)
      
      if (!response.ok) {
        return null
      }

      const card = await response.json()
      this.cache.set(cacheKey, card)
      return card
    } catch (error) {
      console.error('Scryfall getCardByName error:', error)
      return null
    }
  }

  debouncedSearch(query, callback, delay = 300) {
    clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(async () => {
      const results = await this.searchCards(query)
      callback(results)
    }, delay)
  }
}

export const scryfallService = new ScryfallService()
