/**
 * Data models for ManaSell
 */

export class CardRow {
  constructor(data) {
    this.id = data.id || this.generateId()
    this.name = data.name || ''
    this.setCode = data.setCode || ''
    this.collectorNumber = data.collectorNumber || ''
    this.finish = data.finish || 'nonfoil' // 'foil' or 'nonfoil'
    this.totalQuantity = data.quantity || 1 // Original total quantity from CSV
    this.quantity = data.quantity !== undefined ? (data.keepSellStatus === 'keep' ? 0 : 1) : 1 // Editable sell quantity (defaults to 1)
    this.marketPrice = data.marketPrice || 0
    this.setName = data.setName || ''
    this.ckEdition = data.ckEdition || '' // Card Kingdom edition name
    this.keepSellStatus = data.keepSellStatus || 'sell' // 'keep' or 'sell'
    this.warnings = data.warnings || []
    this.originalRows = data.originalRows || [] // Track original CSV rows for deduplication
  }

  generateId() {
    return `${this.name}-${this.setCode}-${this.collectorNumber}-${this.finish}`
  }

  get sellValue() {
    return this.marketPrice * this.quantity
  }

  get shouldSell() {
    // Must have quantity > 0 and not be manually kept
    if (this.keepSellStatus === 'keep') {
      return false
    }
    return this.quantity > 0
  }

  addWarning(warning) {
    if (!this.warnings.includes(warning)) {
      this.warnings.push(warning)
    }
  }

  toExportRow() {
    return {
      title: this.name,
      edition: this.ckEdition || this.setName,
      foil: this.finish === 'foil' ? 1 : 0,
      quantity: this.quantity
    }
  }

  toAuditRow() {
    return {
      name: this.name,
      set: this.setCode,
      collectorNumber: this.collectorNumber,
      finish: this.finish,
      totalQuantity: this.totalQuantity,
      sellQuantity: this.quantity,
      marketPrice: this.marketPrice,
      sellValue: this.sellValue,
      keepSellStatus: this.keepSellStatus,
      warnings: this.warnings.join('; ')
    }
  }
}

export class ManaBoxCSV {
  constructor(rawData) {
    this.rawData = rawData
    this.rows = []
    this.errors = []
  }

  parse() {
    const lines = this.rawData.split('\n').filter(line => line.trim())
    if (lines.length === 0) {
      this.errors.push('CSV file is empty')
      return false
    }

    // Parse header
    const headerLine = lines[0]
    const headers = this.parseCSVLine(headerLine)
    
    // Normalize headers (trim, lowercase for comparison)
    const normalizedHeaders = headers.map(h => h.trim().toLowerCase())
    
    // Map of required columns with possible variations
    const requiredColumnMap = {
      'Card Name': ['card name', 'name', 'card'],
      'Set Code': ['set code', 'set', 'setcode'],
      'Collector Number': ['collector number', 'collector', 'number', 'collector #', 'collector#'],
      'Finish': ['finish', 'foil', 'printing'],
      'Quantity': ['quantity', 'qty', 'qty.', 'count']
    }

    // Find column indices
    this.columnMap = {}
    let missingColumns = []

    for (const [requiredCol, variations] of Object.entries(requiredColumnMap)) {
      const foundIndex = headers.findIndex((h, i) => {
        const normalized = h.trim().toLowerCase()
        return variations.some(v => normalized === v || normalized.includes(v))
      })
      
      if (foundIndex >= 0) {
        this.columnMap[requiredCol] = foundIndex
      } else {
        missingColumns.push(requiredCol)
      }
    }
    
    if (missingColumns.length > 0) {
      this.errors.push(`Missing required columns: ${missingColumns.join(', ')}`)
      return false
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i])
      if (values.length < headers.length) {
        continue // Skip malformed rows
      }

      // Extract required fields using column map
      const cardName = values[this.columnMap['Card Name']]?.trim() || ''
      const setCode = values[this.columnMap['Set Code']]?.trim() || ''
      const collectorNumber = values[this.columnMap['Collector Number']]?.trim() || ''
      const finishRaw = values[this.columnMap['Finish']]?.trim() || ''
      const quantityRaw = values[this.columnMap['Quantity']]?.trim() || '1'
      
      const finish = this.normalizeFinish(finishRaw)
      const quantity = parseInt(quantityRaw, 10) || 1

      if (cardName && setCode && collectorNumber) {
        this.rows.push({
          name: cardName,
          setCode: setCode.toUpperCase(),
          collectorNumber: collectorNumber,
          finish: finish,
          quantity: quantity,
          originalRow: Object.fromEntries(
            headers.map((h, idx) => [h, values[idx]?.trim() || ''])
          )
        })
      }
    }

    return this.rows.length > 0
  }

  parseCSVLine(line) {
    const result = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current)
    return result
  }

  normalizeFinish(finish) {
    const normalized = (finish || '').toLowerCase().trim()
    if (normalized.includes('foil') || normalized === 'f') {
      return 'foil'
    }
    return 'nonfoil'
  }
}
