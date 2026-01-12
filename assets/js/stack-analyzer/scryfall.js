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
      let autocompleteSuggestions = []
      try {
        const autocompleteUrl = `${SCRYFALL_API}/cards/autocomplete?q=${encodeURIComponent(query)}`
        const autocompleteResponse = await fetch(autocompleteUrl)
        if (autocompleteResponse.ok) {
          const autocompleteData = await autocompleteResponse.json()
          if (autocompleteData.data && autocompleteData.data.length > 0) {
            autocompleteSuggestions = autocompleteData.data.slice(0, limit)
          }
        }
      } catch (e) {
        // If autocomplete fails, continue
      }

      // If we have autocomplete suggestions, fetch the full card data for each
      if (autocompleteSuggestions.length > 0) {
        const cards = []
        for (const cardName of autocompleteSuggestions) {
          try {
            // Use exact match for autocomplete suggestions since they're already exact names
            const card = await this.getCardByName(cardName, false)
            if (card) {
              cards.push(card)
              // Stop once we have enough cards
              if (cards.length >= limit) break
            }
          } catch (e) {
            console.warn(`Failed to fetch card: ${cardName}`, e)
            // Skip this card if fetch fails
          }
        }
        if (cards.length > 0) {
          this.cache.set(cacheKey, cards)
          return cards
        }
      }

      // Fallback: try regular search API
      const searchUrl = `${SCRYFALL_API}/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=released&dir=desc&limit=${limit}`
      const searchResponse = await fetch(searchUrl)
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        const cards = searchData.data || []
        if (cards.length > 0) {
          this.cache.set(cacheKey, cards)
          return cards
        }
      }

      // Last resort: try fuzzy named search
      try {
        const namedCard = await this.getCardByName(query, true)
        if (namedCard) {
          this.cache.set(cacheKey, [namedCard])
          return [namedCard]
        }
      } catch (e) {
        // Named endpoint failed
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
      try {
        const results = await this.searchCards(query)
        callback(results)
      } catch (error) {
        console.error('Search error:', error)
        callback([])
      }
    }, delay)
  }
}

export const scryfallService = new ScryfallService()
