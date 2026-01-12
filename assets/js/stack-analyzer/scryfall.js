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
      // First, try to get autocomplete suggestions for better matching
      let searchTerms = [query]
      try {
        const autocompleteUrl = `${SCRYFALL_API}/cards/autocomplete?q=${encodeURIComponent(query)}`
        const autocompleteResponse = await fetch(autocompleteUrl)
        if (autocompleteResponse.ok) {
          const autocompleteData = await autocompleteResponse.json()
          if (autocompleteData.data && autocompleteData.data.length > 0) {
            // Use autocomplete suggestions as search terms
            searchTerms = autocompleteData.data.slice(0, 3)
          }
        }
      } catch (e) {
        // If autocomplete fails, just use the original query
      }

      // Try searching with each term, starting with the most likely match
      for (const term of searchTerms) {
        // Use name search with the term - Scryfall handles apostrophes correctly
        const searchQuery = term.includes(' ') ? `!"${term}"` : term
        const url = `${SCRYFALL_API}/cards/search?q=${encodeURIComponent(searchQuery)}&unique=cards&order=released&dir=desc&limit=${limit}`
        const response = await fetch(url)
        
        if (response.ok) {
          const data = await response.json()
          const cards = data.data || []
          
          if (cards.length > 0) {
            // Cache results
            this.cache.set(cacheKey, cards)
            return cards
          }
        }
      }

      // If all searches failed, return empty
      return []
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
