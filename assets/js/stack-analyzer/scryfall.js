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
      // First, try autocomplete to get suggestions
      let searchTerms = [query]
      try {
        const autocompleteUrl = `${SCRYFALL_API}/cards/autocomplete?q=${encodeURIComponent(query)}`
        const autocompleteResponse = await fetch(autocompleteUrl)
        if (autocompleteResponse.ok) {
          const autocompleteData = await autocompleteResponse.json()
          if (autocompleteData.data && autocompleteData.data.length > 0) {
            // Use autocomplete suggestions - these are exact card names
            searchTerms = autocompleteData.data.slice(0, 5)
          }
        }
      } catch (e) {
        // If autocomplete fails, continue with original query
      }

      // Try searching with each autocomplete suggestion
      for (const term of searchTerms) {
        // Search by exact name first
        const exactUrl = `${SCRYFALL_API}/cards/search?q=${encodeURIComponent(`!"${term}"`)}&unique=cards&order=released&dir=desc&limit=${limit}`
        const exactResponse = await fetch(exactUrl)
        
        if (exactResponse.ok) {
          const exactData = await exactResponse.json()
          const cards = exactData.data || []
          
          if (cards.length > 0) {
            this.cache.set(cacheKey, cards)
            return cards
          }
        }
      }

      // If autocomplete suggestions didn't work, try fuzzy search on the original query
      // This helps with typos like "K'riik" vs "K'rrik"
      if (query.length >= 3) {
        const fuzzyUrl = `${SCRYFALL_API}/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=released&dir=desc&limit=${limit}`
        const fuzzyResponse = await fetch(fuzzyUrl)
        
        if (fuzzyResponse.ok) {
          const fuzzyData = await fuzzyResponse.json()
          const cards = fuzzyData.data || []
          
          if (cards.length > 0) {
            this.cache.set(cacheKey, cards)
            return cards
          }
        }
      }

      // Last resort: try the named endpoint with fuzzy matching
      try {
        const namedCard = await this.getCardByName(query, true)
        if (namedCard) {
          this.cache.set(cacheKey, [namedCard])
          return [namedCard]
        }
      } catch (e) {
        // Named endpoint failed, continue
      }

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

  async getAutocompleteSuggestions(query) {
    if (!query || query.length < 2) {
      return []
    }

    try {
      const autocompleteUrl = `${SCRYFALL_API}/cards/autocomplete?q=${encodeURIComponent(query)}`
      const response = await fetch(autocompleteUrl)
      if (response.ok) {
        const data = await response.json()
        return data.data || []
      }
    } catch (error) {
      console.error('Scryfall autocomplete error:', error)
    }
    return []
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
