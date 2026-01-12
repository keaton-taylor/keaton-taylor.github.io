/**
 * ManaSell Main Application Controller
 */

import { CardRow, ManaBoxCSV, TextListParser } from './models.js'
import { scryfallEnricher } from './scryfallEnricher.js'
import { cardKingdomMapper } from './cardKingdomMapper.js'

class ManaSellApp {
  constructor() {
    this.cardRows = []
    this.filteredRows = []
    this.initializeUI()
  }

  initializeUI() {
    // File upload
    const fileInput = document.getElementById('csv-file-input')
    fileInput.addEventListener('change', (e) => this.handleFileUpload(e))

    // Paste submit button
    const pasteSubmit = document.getElementById('paste-submit-btn')
    pasteSubmit.addEventListener('click', () => this.handlePasteSubmit())

    // Price threshold controls
    const minPrice = document.getElementById('min-price')
    const maxPrice = document.getElementById('max-price')
    const includeFoil = document.getElementById('include-foil')
    const includeNonfoil = document.getElementById('include-nonfoil')

    minPrice.addEventListener('input', () => this.applyFilters())
    maxPrice.addEventListener('input', () => this.applyFilters())
    includeFoil.addEventListener('change', () => this.applyFilters())
    includeNonfoil.addEventListener('change', () => this.applyFilters())

    // Bulk actions
    document.getElementById('keep-all-foils').addEventListener('click', () => this.keepAllFoils())
    document.getElementById('keep-one-copy').addEventListener('click', () => this.keepOneCopy())
    document.getElementById('sell-duplicates').addEventListener('click', () => this.sellDuplicates())
    document.getElementById('mark-all-sell').addEventListener('click', () => this.markAllSell())
    document.getElementById('reset-all-sell').addEventListener('click', () => this.resetAllSell())

    // Export buttons
    document.getElementById('export-ck-btn').addEventListener('click', () => this.exportCardKingdom())
    document.getElementById('export-audit-btn').addEventListener('click', () => this.exportAudit())
  }

  switchInputMethod(method) {
    const csvTab = document.getElementById('csv-tab')
    const pasteTab = document.getElementById('paste-tab')
    const csvInput = document.getElementById('csv-input')
    const pasteInput = document.getElementById('paste-input')

    if (method === 'csv') {
      csvTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600')
      csvTab.classList.remove('text-gray-500')
      pasteTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600')
      pasteTab.classList.add('text-gray-500')
      csvInput.classList.remove('hidden')
      pasteInput.classList.add('hidden')
    } else {
      pasteTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600')
      pasteTab.classList.remove('text-gray-500')
      csvTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600')
      csvTab.classList.add('text-gray-500')
      pasteInput.classList.remove('hidden')
      csvInput.classList.add('hidden')
    }
  }

  async handleFileUpload(event) {
    const file = event.target.files[0]
    if (!file) {
      return
    }

    // Hide error
    this.hideError()

    // Read file
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const csvData = e.target.result
        await this.processCSV(csvData)
      } catch (error) {
        this.showError(error.message || 'Failed to process CSV file')
      }
    }
    reader.onerror = () => {
      this.showError('Failed to read file')
    }
    reader.readAsText(file)
  }

  async handlePasteSubmit() {
    const textarea = document.getElementById('paste-textarea')
    const text = textarea.value.trim()

    if (!text) {
      this.showError('Please paste a list of cards')
      return
    }

    // Hide error
    this.hideError()

    try {
      await this.processTextList(text)
    } catch (error) {
      this.showError(error.message || 'Failed to process card list')
    }
  }

  async processTextList(textData) {
    // Parse text list
    const parser = new TextListParser(textData)
    if (!parser.parse()) {
      this.showError(
        parser.errors.length > 0
          ? parser.errors.join('; ')
          : 'Failed to parse card list. Check format: Card Name [SET] collector# finish qty'
      )
      return
    }

    // Debug: Log parsed rows
    console.log('Parsed text list rows:', parser.rows.slice(0, 3))

    // Normalize and deduplicate
    const normalized = this.normalizeAndDeduplicate(parser.rows)
    
    // Convert to CardRow objects - default quantity to 1
    this.cardRows = normalized.map(row => {
      const cardRow = new CardRow(row)
      // Default sell quantity to 1 (not total quantity)
      if (cardRow.keepSellStatus === 'sell') {
        cardRow.quantity = 1
      }
      return cardRow
    })

    // Show controls
    document.getElementById('controls-section').classList.remove('hidden')
    document.getElementById('review-section').classList.remove('hidden')
    document.getElementById('export-section').classList.remove('hidden')

    // Show loading state
    this.showLoadingState()

    // Enrich with Scryfall data
    await scryfallEnricher.enrichCards(this.cardRows, (processed, total) => {
      // Could show progress here if needed
      console.log(`Enriched ${processed}/${total} cards`)
    })

    // Render table
    this.applyFilters()
  }

  async processCSV(csvData) {
    // Parse CSV
    const csv = new ManaBoxCSV(csvData)
    if (!csv.parse()) {
      this.showError(
        csv.errors.length > 0
          ? csv.errors.join('; ')
          : 'This file doesn\'t match ManaBox\'s CSV format. Re-export from ManaBox → Collection → Export CSV.'
      )
      return
    }

    // Debug: Log column mapping for verification
    if (csv.columnMap) {
      console.log('Column mapping:', csv.columnMap)
      // Log first few rows to verify parsing
      if (csv.rows.length > 0) {
        console.log('Sample parsed rows:', csv.rows.slice(0, 3))
      }
    }

    // Normalize and deduplicate
    const normalized = this.normalizeAndDeduplicate(csv.rows)
    
    // Convert to CardRow objects - default quantity to 1
    this.cardRows = normalized.map(row => {
      const cardRow = new CardRow(row)
      // Default sell quantity to 1 (not total quantity)
      if (cardRow.keepSellStatus === 'sell') {
        cardRow.quantity = 1
      }
      return cardRow
    })

    // Show controls
    document.getElementById('controls-section').classList.remove('hidden')
    document.getElementById('review-section').classList.remove('hidden')
    document.getElementById('export-section').classList.remove('hidden')

    // Show loading state
    this.showLoadingState()

    // Enrich with Scryfall data
    await scryfallEnricher.enrichCards(this.cardRows, (processed, total) => {
      // Could show progress here if needed
      console.log(`Enriched ${processed}/${total} cards`)
    })

    // Render table
    this.applyFilters()
  }

  normalizeAndDeduplicate(rows) {
    // Group by card identity (name, set, collector number, finish)
    const grouped = new Map()

    rows.forEach(row => {
      const key = `${row.name}|${row.setCode}|${row.collectorNumber}|${row.finish}`
      
      if (grouped.has(key)) {
        grouped.get(key).quantity += row.quantity
        grouped.get(key).originalRows.push(row)
      } else {
        grouped.set(key, {
          ...row,
          originalRows: [row]
        })
      }
    })

    return Array.from(grouped.values())
  }

  applyFilters() {
    const minPrice = parseFloat(document.getElementById('min-price').value) || 0
    const maxPriceInput = document.getElementById('max-price').value
    const maxPrice = maxPriceInput ? parseFloat(maxPriceInput) : Infinity
    const includeFoil = document.getElementById('include-foil').checked
    const includeNonfoil = document.getElementById('include-nonfoil').checked

    this.filteredRows = this.cardRows.filter(row => {
      // Price filter
      if (row.marketPrice < minPrice || row.marketPrice > maxPrice) {
        return false
      }

      // Finish filter
      if (row.finish === 'foil' && !includeFoil) {
        return false
      }
      if (row.finish === 'nonfoil' && !includeNonfoil) {
        return false
      }

      return true
    })

    this.renderTable()
    this.updateSummary()
  }

  renderTable() {
    const tbody = document.getElementById('review-table-body')
    tbody.innerHTML = ''

    if (this.filteredRows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="px-4 py-8 text-center text-gray-400">
            No cards match the current filters
          </td>
        </tr>
      `
      return
    }

    this.filteredRows.forEach(row => {
      const tr = document.createElement('tr')
      tr.className = 'hover:bg-slate-50'
      if (row.warnings.length > 0) {
        tr.className += ' border-l-4 border-amber-400'
      }

      const status = row.keepSellStatus === 'keep' ? 'keep' : 'sell'
      const statusColor = status === 'keep' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
      
      tr.innerHTML = `
        <td class="px-2 py-3">
          <button
            data-card-id="${row.id}"
            class="px-2 py-1 text-xs rounded ${statusColor} hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onclick="manasellApp.toggleKeepSell('${row.id}')"
          >
            ${status === 'keep' ? 'Keep' : 'Sell'}
          </button>
        </td>
        <td class="px-2 py-3 text-sm">${this.escapeHtml(row.name)}</td>
        <td class="px-2 py-3 text-sm">
          <span class="font-semibold">${this.escapeHtml(row.setCode)}</span>
          <br>
          <span class="text-xs text-gray-500">${this.escapeHtml(row.setName)}</span>
        </td>
        <td class="px-2 py-3 text-sm">${this.escapeHtml(row.collectorNumber)}</td>
        <td class="px-2 py-3 text-sm">${row.finish === 'foil' ? 'Foil' : 'Non-Foil'}</td>
        <td class="px-2 py-3">
          <div class="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="${row.totalQuantity}"
              value="${row.quantity}"
              data-card-id="${this.escapeHtml(row.id)}"
              class="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            ${row.quantity < row.totalQuantity ? `<span class="text-xs text-gray-400">/ ${row.totalQuantity}</span>` : ''}
          </div>
        </td>
        <td class="px-2 py-3 text-sm">$${row.marketPrice.toFixed(2)}</td>
        <td class="px-2 py-3 text-sm font-semibold">$${row.sellValue.toFixed(2)}</td>
        <td class="px-2 py-3">
          ${row.warnings.map(w => `
            <span class="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded inline-block mb-1">
              ${this.escapeHtml(w)}
            </span>
          `).join('')}
        </td>
      `
      tbody.appendChild(tr)
    })
    
    // Attach event listeners after rendering
    this.attachQuantityListeners()
  }

  attachQuantityListeners() {
    const inputs = document.querySelectorAll('input[data-card-id]')
    inputs.forEach(input => {
      // Remove existing listeners by cloning
      const newInput = input.cloneNode(true)
      input.parentNode.replaceChild(newInput, input)
      
      // Add new listeners
      newInput.addEventListener('change', (e) => {
        const cardId = e.target.getAttribute('data-card-id')
        this.updateQuantity(cardId, e.target.value)
      })
      newInput.addEventListener('input', (e) => {
        const cardId = e.target.getAttribute('data-card-id')
        this.updateQuantity(cardId, e.target.value, false) // Don't re-render on input
      })
    })
  }

  toggleKeepSell(cardId) {
    const row = this.cardRows.find(r => r.id === cardId)
    if (row) {
      const newStatus = row.keepSellStatus === 'keep' ? 'sell' : 'keep'
      row.keepSellStatus = newStatus
      
      // Update quantity based on status
      if (newStatus === 'keep') {
        row.quantity = 0
      } else {
        // When switching to sell, default to 1
        row.quantity = 1
      }
      
      this.renderTable()
      this.updateSummary()
    }
  }

  updateQuantity(cardId, value, shouldRender = true) {
    const row = this.cardRows.find(r => r.id === cardId)
    if (!row) {
      console.error('Card not found:', cardId)
      return
    }
    
    const newQty = Math.max(0, Math.min(row.totalQuantity, parseInt(value, 10) || 0))
    row.quantity = newQty
    
    // Auto-update status based on quantity
    if (newQty === 0) {
      row.keepSellStatus = 'keep'
    } else {
      row.keepSellStatus = 'sell'
    }
    
    // Update the button status if needed
    if (shouldRender) {
      const button = document.querySelector(`button[data-card-id="${cardId}"]`)
      if (button) {
        const status = row.keepSellStatus === 'keep' ? 'keep' : 'sell'
        const statusColor = status === 'keep' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
        button.textContent = status === 'keep' ? 'Keep' : 'Sell'
        button.className = `px-2 py-1 text-xs rounded ${statusColor} hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500`
      }
      
      // Update the total value cell
      const rowElement = button?.closest('tr')
      if (rowElement) {
        const valueCell = rowElement.querySelectorAll('td')[7] // Total Value column
        if (valueCell) {
          valueCell.textContent = `$${row.sellValue.toFixed(2)}`
        }
        
        // Update the "/ total" hint
        const qtyCell = rowElement.querySelectorAll('td')[5] // Quantity column
        if (qtyCell) {
          const hint = qtyCell.querySelector('span')
          if (hint) {
            if (row.quantity < row.totalQuantity) {
              hint.textContent = `/ ${row.totalQuantity}`
              hint.style.display = 'inline'
            } else {
              hint.style.display = 'none'
            }
          }
        }
      }
    }
    
    this.updateSummary()
  }

  keepAllFoils() {
    this.cardRows.forEach(row => {
      if (row.finish === 'foil') {
        row.keepSellStatus = 'keep'
        row.quantity = 0
      }
    })
    this.renderTable()
    this.updateSummary()
  }

  keepOneCopy() {
    // Group by card identity (name, set, collector number)
    const grouped = new Map()
    
    this.cardRows.forEach(row => {
      const key = `${row.name}|${row.setCode}|${row.collectorNumber}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key).push(row)
    })

    // For each group, keep one copy (prefer non-foil if available)
    grouped.forEach(rows => {
      // Sort: non-foil first, then by quantity (keep the one with lower quantity)
      rows.sort((a, b) => {
        if (a.finish !== b.finish) {
          return a.finish === 'nonfoil' ? -1 : 1
        }
        return a.quantity - b.quantity
      })

      // Keep the first one, sell the rest
      rows.forEach((row, index) => {
        if (index === 0) {
          row.keepSellStatus = 'keep'
          row.quantity = 0
        } else {
          row.keepSellStatus = 'sell'
          row.quantity = 1
        }
      })
    })

    this.renderTable()
    this.updateSummary()
  }

  sellDuplicates() {
    // Group by card identity
    const grouped = new Map()
    
    this.cardRows.forEach(row => {
      const key = `${row.name}|${row.setCode}|${row.collectorNumber}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key).push(row)
    })

    // For each group with multiple entries, keep one, sell the rest
    grouped.forEach(rows => {
      if (rows.length > 1) {
        // Keep the one with highest quantity (or first if equal)
        rows.sort((a, b) => b.quantity - a.quantity)
        rows.forEach((row, index) => {
          if (index === 0) {
            row.keepSellStatus = 'keep'
            row.quantity = 0
          } else {
            row.keepSellStatus = 'sell'
            row.quantity = 1
          }
        })
      }
    })

    this.renderTable()
    this.updateSummary()
  }

  markAllSell() {
    this.cardRows.forEach(row => {
      row.keepSellStatus = 'sell'
      row.quantity = 1
    })
    this.renderTable()
    this.updateSummary()
  }

  resetAllSell() {
    this.cardRows.forEach(row => {
      row.keepSellStatus = 'sell'
      row.quantity = 1
    })
    this.renderTable()
    this.updateSummary()
  }

  updateSummary() {
    // Summary shows filtered view stats
    const totalCards = this.filteredRows.length
    const filteredSellRows = this.filteredRows.filter(row => row.shouldSell)
    const filteredSellCount = filteredSellRows.length
    const filteredTotalValue = filteredSellRows.reduce((sum, row) => sum + row.sellValue, 0)

    // Export stats show all cards marked for sale
    const allSellRows = this.cardRows.filter(row => row.shouldSell)
    const allSellCount = allSellRows.length
    const allTotalValue = allSellRows.reduce((sum, row) => sum + row.sellValue, 0)
    
    // Calculate total quantity to sell
    const totalSellQuantity = allSellRows.reduce((sum, row) => sum + row.quantity, 0)

    document.getElementById('total-cards').textContent = totalCards
    document.getElementById('sell-count').textContent = filteredSellCount
    document.getElementById('total-value').textContent = filteredTotalValue.toFixed(2)
    document.getElementById('export-count').textContent = `${allSellCount} (${totalSellQuantity} cards)`
    document.getElementById('export-value').textContent = allTotalValue.toFixed(2)
  }

  exportCardKingdom() {
    const csv = cardKingdomMapper.toCardKingdomCSV(this.cardRows)
    cardKingdomMapper.downloadCSV(csv, 'card-kingdom-bulk.csv')
  }

  exportAudit() {
    const csv = cardKingdomMapper.toAuditCSV(this.cardRows)
    cardKingdomMapper.downloadCSV(csv, 'manasell-audit.csv')
  }

  showError(message) {
    const errorDiv = document.getElementById('upload-error')
    const errorMessage = document.getElementById('upload-error-message')
    errorMessage.textContent = message
    errorDiv.classList.remove('hidden')
  }

  hideError() {
    document.getElementById('upload-error').classList.add('hidden')
  }

  showLoadingState() {
    const tbody = document.getElementById('review-table-body')
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-4 py-8 text-center text-gray-400">
          Loading card data from Scryfall...
        </td>
      </tr>
    `
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

// Initialize app
const manasellApp = new ManaSellApp()
window.manasellApp = manasellApp // Make accessible for onclick handlers
