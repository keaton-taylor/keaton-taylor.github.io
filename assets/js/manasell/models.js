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
    
    // Map of required columns with possible variations (ordered by priority)
    const requiredColumnMap = {
      'Card Name': ['card name', 'cardname', 'card_name', 'name'], // 'name' is last resort
      'Set Code': ['set code', 'setcode', 'set_code', 'set'],
      'Collector Number': ['collector number', 'collector_number', 'collector #', 'collector#', 'collector', 'number'],
      'Finish': ['finish', 'foil', 'printing'],
      'Quantity': ['quantity', 'qty', 'qty.', 'count']
    }

    // Find column indices - prefer exact matches, then partial matches
    this.columnMap = {}
    let missingColumns = []

    for (const [requiredCol, variations] of Object.entries(requiredColumnMap)) {
      // Try variations in order of priority
      let foundIndex = -1
      
      for (const variation of variations) {
        // First try exact match
        foundIndex = headers.findIndex((h, i) => {
          const normalized = h.trim().toLowerCase()
          return normalized === variation
        })
        
        // If exact match found, use it
        if (foundIndex >= 0) {
          break
        }
        
        // For "name" specifically, be very strict - only match if it's the whole word
        if (variation === 'name' && requiredCol === 'Card Name') {
          foundIndex = headers.findIndex((h, i) => {
            const normalized = h.trim().toLowerCase()
            // Match "name" only if it's at the end or start, or is the whole header
            return normalized === 'name' || 
                   normalized === 'card name' ||
                   normalized.endsWith(' card name') ||
                   normalized.startsWith('card name')
          })
          if (foundIndex >= 0) {
            break
          }
        } else {
          // For other variations, try partial match but be strict
          foundIndex = headers.findIndex((h, i) => {
            const normalized = h.trim().toLowerCase()
            // Only match if variation is significant length or at word boundaries
            if (variation.length >= 4) {
              return normalized.includes(variation)
            } else {
              // For short variations, require exact match or word boundary
              return normalized === variation || 
                     normalized.startsWith(variation + ' ') ||
                     normalized.endsWith(' ' + variation)
            }
          })
          if (foundIndex >= 0) {
            break
          }
        }
      }
      
      if (foundIndex >= 0) {
        this.columnMap[requiredCol] = foundIndex
        console.log(`Mapped "${requiredCol}" to column ${foundIndex}: "${headers[foundIndex]}"`)
      } else {
        missingColumns.push(requiredCol)
      }
    }
    
    if (missingColumns.length > 0) {
      this.errors.push(`Missing required columns: ${missingColumns.join(', ')}`)
      return false
    }

    // Parse data rows - process in chunks for large files
    const chunkSize = 1000
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i])
      if (values.length < headers.length) {
        continue // Skip malformed rows
      }

      // Extract required fields using column map
      const cardNameIndex = this.columnMap['Card Name']
      const setCodeIndex = this.columnMap['Set Code']
      const collectorNumberIndex = this.columnMap['Collector Number']
      const finishIndex = this.columnMap['Finish']
      const quantityIndex = this.columnMap['Quantity']
      
      if (cardNameIndex === undefined || setCodeIndex === undefined || collectorNumberIndex === undefined) {
        continue // Skip if required columns not found
      }

      const cardName = values[cardNameIndex]?.trim() || ''
      const setCode = values[setCodeIndex]?.trim() || ''
      const collectorNumber = values[collectorNumberIndex]?.trim() || ''
      const finishRaw = finishIndex !== undefined ? (values[finishIndex]?.trim() || '') : ''
      const quantityRaw = quantityIndex !== undefined ? (values[quantityIndex]?.trim() || '1') : '1'
      
      const finish = this.normalizeFinish(finishRaw)
      const quantity = parseInt(quantityRaw, 10) || 1

      // Validate card name is not empty and doesn't look like a path/directory
      if (cardName && setCode && collectorNumber && !cardName.includes('/') && !cardName.includes('\\')) {
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

export class TextListParser {
  constructor(rawText) {
    this.rawText = rawText
    this.rows = []
    this.errors = []
  }

  parse() {
    const lines = this.rawText.split('\n').filter(line => line.trim())
    if (lines.length === 0) {
      this.errors.push('No cards found in pasted text')
      return false
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Parse format: Qty Card name (set) number ?*F*?
      // Examples:
      // "1 The Legend of Kuruk / Avatar Kuruk (TLA) 61"
      // "1 The Legend of Yangchen / Avatar Yangchen (PTLA) 27s *F*"
      // "1 Uthros, Titanic Godcore (EOE) 260"
      
      // Match: quantity, card name, (set code), collector number, optional *F*
      const match = line.match(/^(\d+)\s+(.+?)\s+\(([A-Z0-9]+)\)\s+([A-Z0-9]+)(?:\s+\*F\*)?$/i)
      
      if (match) {
        const quantityRaw = match[1].trim()
        const cardName = match[2].trim()
        const setCode = match[3].toUpperCase().trim()
        const collectorNumber = match[4].trim()
        const hasFoil = line.includes('*F*')
        
        const finish = hasFoil ? 'foil' : 'nonfoil'
        const quantity = parseInt(quantityRaw, 10) || 1

        if (cardName && setCode && collectorNumber) {
          this.rows.push({
            name: cardName,
            setCode: setCode,
            collectorNumber: collectorNumber,
            finish: finish,
            quantity: quantity,
            originalRow: line
          })
        }
      } else {
        // Skip invalid lines but don't error - just log
        console.warn(`Skipping invalid line ${i + 1}: ${line}`)
      }
    }

    if (this.rows.length === 0) {
      this.errors.push('No valid cards found. Check format: Card Name [SET] collector# finish qty')
      return false
    }

    return true
  }

  normalizeFinish(finish) {
    const normalized = (finish || '').toLowerCase().trim()
    if (normalized.includes('foil') || normalized === 'f') {
      return 'foil'
    }
    return 'nonfoil'
  }
}
