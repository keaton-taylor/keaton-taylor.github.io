/**
 * Card Kingdom CSV export mapping
 */

export class CardKingdomMapper {
  /**
   * Convert card rows to Card Kingdom CSV format
   */
  toCardKingdomCSV(cardRows) {
    const sellRows = cardRows.filter(row => row.shouldSell)
    
    // Group by printing (title, edition, foil) and sum quantities
    const grouped = new Map()
    
    sellRows.forEach(row => {
      const key = `${row.name}|${row.ckEdition || row.setName}|${row.finish}`
      
      if (grouped.has(key)) {
        grouped.get(key).quantity += row.quantity
      } else {
        grouped.set(key, {
          title: row.name,
          edition: row.ckEdition || row.setName || row.setCode,
          foil: row.finish === 'foil',
          quantity: row.quantity
        })
      }
    })

    // Match Card Kingdom example: Title, Edition (full set name), Foil (TRUE/FALSE), Quantity
    const headers = ['Title', 'Edition', 'Foil', 'Quantity']
    const rows = Array.from(grouped.values()).map(row => [
      this.escapeCSV(String(row.title || '').trim()),
      this.escapeCSV(String(row.edition || '').trim()),
      row.foil ? 'TRUE' : 'FALSE',
      row.quantity
    ])

    return this.generateCSV(headers, rows)
  }

  /**
   * Generate audit CSV with full details
   */
  toAuditCSV(cardRows) {
    const headers = [
      'Card Name',
      'Set',
      'Collector Number',
      'Finish',
      'Total Quantity',
      'Sell Quantity',
      'Market Price',
      'Sell Value',
      'Keep/Sell Status',
      'Warnings'
    ]

    const rows = cardRows.map(row => {
      const audit = row.toAuditRow()
      return [
        this.escapeCSV(audit.name),
        this.escapeCSV(audit.set),
        this.escapeCSV(audit.collectorNumber),
        this.escapeCSV(audit.finish),
        audit.totalQuantity,
        audit.sellQuantity,
        audit.marketPrice.toFixed(2),
        audit.sellValue.toFixed(2),
        this.escapeCSV(audit.keepSellStatus),
        this.escapeCSV(audit.warnings)
      ]
    })

    return this.generateCSV(headers, rows)
  }

  /**
   * Escape CSV values
   */
  escapeCSV(value) {
    if (value === null || value === undefined) {
      return ''
    }
    
    const stringValue = String(value)
    
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`
    }
    
    return stringValue
  }

  /**
   * Generate CSV string from headers and rows.
   * Uses CRLF so Excel/Windows and web parsers handle the file reliably.
   */
  generateCSV(headers, rows) {
    const csvRows = [
      headers.map(h => this.escapeCSV(h)).join(','),
      ...rows.map(row => row.join(','))
    ]
    return csvRows.join('\r\n')
  }

  /**
   * Download CSV file.
   * Prepends UTF-8 BOM so parsers (Excel, CK) detect encoding correctly.
   */
  downloadCSV(csvContent, filename) {
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  }
}

export const cardKingdomMapper = new CardKingdomMapper()
