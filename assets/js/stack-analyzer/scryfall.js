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
      // Try autocomplete first for better results with special characters
      const autocompleteUrl = `${SCRYFALL_API}/cards/autocomplete?q=${encodeURIComponent(query)}`
      const autocompleteResponse = await fetch(autocompleteUrl)
      
      let searchQuery = query
      if (autocompleteResponse.ok) {
        const autocompleteData = await autocompleteResponse.json()
        if (autocompleteData.data && autocompleteData.data.length > 0) {
          // Use the first autocomplete suggestion for more accurate results
          searchQuery = autocompleteData.data[0]
        }
      }

      // Build search query - use name search for better matching
      // Escape special characters and use quotes for exact phrase matching
      const escapedQuery = searchQuery.replace(/'/g, "\\'")
      const scryfallQuery = `!"${escapedQuery}" OR ${escapedQuery}`
      
      const url = `${SCRYFALL_API}/cards/search?q=${encodeURIComponent(scryfallQuery)}&unique=cards&order=released&dir=desc&limit=${limit}`
      const response = await fetch(url)
      
      if (!response.ok) {
        if (response.status === 404) {
          // If exact search fails, try a simpler search without quotes
          const fallbackUrl = `${SCRYFALL_API}/cards/search?q=${encodeURIComponent(searchQuery)}&unique=cards&order=released&dir=desc&limit=${limit}`
          const fallbackResponse = await fetch(fallbackUrl)
          
          if (!fallbackResponse.ok) {
            return []
          }
          
          const fallbackData = await fallbackResponse.json()
          const cards = fallbackData.data || []
          this.cache.set(cacheKey, cards)
          return cards
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
