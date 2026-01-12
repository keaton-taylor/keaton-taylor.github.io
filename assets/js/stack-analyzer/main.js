/**
 * Main Application Controller
 * Orchestrates all components and handles user interactions
 */

import { StackObject, GameState, Scenario } from './models.js'
import { scryfallService } from './scryfall.js'
import { ResolutionEngine } from './resolution.js'
import { StackVisualization } from './stack-visualization.js'

class StackAnalyzerApp {
  constructor() {
    this.scenario = new Scenario()
    this.currentPlayer = 'A'
    this.selectedCard = null
    this.targets = []
    this.resolutionEngine = new ResolutionEngine(this.scenario.currentState)
    this.stackViz = new StackVisualization('stack-container')
    
    this.initializeUI()
    this.loadFromURL()
  }

  initializeUI() {
    // Player selector
    document.getElementById('player-a-btn').addEventListener('click', () => {
      this.setCurrentPlayer('A')
    })
    document.getElementById('player-b-btn').addEventListener('click', () => {
      this.setCurrentPlayer('B')
    })
    document.getElementById('player-c-btn').addEventListener('click', () => {
      this.setCurrentPlayer('C')
    })
    document.getElementById('player-d-btn').addEventListener('click', () => {
      this.setCurrentPlayer('D')
    })

    // Card search
    const cardSearch = document.getElementById('card-search')
    cardSearch.addEventListener('input', (e) => {
      this.handleCardSearch(e.target.value)
    })

    // Battlefield card search
    const battlefieldCardSearch = document.getElementById('battlefield-card-search')
    battlefieldCardSearch.addEventListener('input', (e) => {
      this.handleBattlefieldCardSearch(e.target.value)
    })

    // Action type selector
    document.getElementById('action-type').addEventListener('change', () => {
      this.updateUIState()
    })

    // Add target button
    document.getElementById('add-target-btn').addEventListener('click', () => {
      this.addTarget()
    })

    // Add action button
    document.getElementById('add-action-btn').addEventListener('click', () => {
      this.addActionToStack()
    })

    // Respond button
    document.getElementById('respond-btn').addEventListener('click', () => {
      this.respondToStack()
    })

    // Playback controls
    document.getElementById('step-resolve-btn').addEventListener('click', () => {
      this.stepResolve()
    })
    document.getElementById('auto-resolve-btn').addEventListener('click', () => {
      this.autoResolve()
    })
    document.getElementById('reset-btn').addEventListener('click', () => {
      this.resetScenario()
    })
    document.getElementById('share-btn').addEventListener('click', () => {
      this.shareScenario()
    })

    // Initial UI update
    this.updateUI()
    this.updateBattlefieldDisplay()
  }

  setCurrentPlayer(player) {
    this.currentPlayer = player
    const players = ['A', 'B', 'C', 'D']
    players.forEach(p => {
      const btn = document.getElementById(`player-${p.toLowerCase()}-btn`)
      if (btn) {
        btn.classList.toggle('active-player', player === p)
        btn.classList.toggle('opacity-75', player !== p)
      }
    })
    
    // Update battlefield player label
    const playerLabel = document.getElementById('battlefield-player-label')
    if (playerLabel) {
      const playerColors = {
        'A': 'text-blue-600',
        'B': 'text-red-600',
        'C': 'text-green-600',
        'D': 'text-purple-600',
      }
      playerLabel.textContent = player
      playerLabel.className = playerColors[player] || 'text-gray-600'
    }
    
    this.updateBattlefieldDisplay()
    this.updateUIState()
  }

  async handleCardSearch(query) {
    const resultsContainer = document.getElementById('card-results')
    
    if (!query || query.length < 2) {
      resultsContainer.classList.add('hidden')
      return
    }

    // First, try to get autocomplete suggestions for immediate feedback
    const autocompleteSuggestions = await scryfallService.getAutocompleteSuggestions(query)
    
    // If we have autocomplete suggestions, search for those cards directly
    if (autocompleteSuggestions.length > 0) {
      const cards = []
      for (const suggestion of autocompleteSuggestions.slice(0, 10)) {
        const card = await scryfallService.getCardByName(suggestion, false)
        if (card) {
          cards.push(card)
        }
      }
      if (cards.length > 0) {
        this.displayCardResults(cards)
        return
      }
    }

    // Fall back to regular search
    scryfallService.debouncedSearch(query, (cards) => {
      this.displayCardResults(cards)
    })
  }

  displayCardResults(cards) {
    const resultsContainer = document.getElementById('card-results')
    
    if (cards.length === 0) {
      resultsContainer.innerHTML = '<div class="p-3 text-sm text-gray-500 text-center">No cards found</div>'
      resultsContainer.classList.remove('hidden')
      return
    }

    resultsContainer.innerHTML = cards.map((card, index) => `
      <div 
        class="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 transition-colors card-result-item ${index === 0 ? 'bg-blue-50' : ''}"
        data-card-id="${card.id}"
        data-card-name="${card.name}"
      >
        <div class="font-medium text-sm text-gray-900">${card.name}</div>
        <div class="text-xs text-gray-500 mt-0.5">${card.type_line}</div>
        ${card.mana_cost ? `<div class="text-xs text-gray-400 mt-1">${card.mana_cost}</div>` : ''}
      </div>
    `).join('')

    resultsContainer.classList.remove('hidden')

    // Add click handlers
    resultsContainer.querySelectorAll('.card-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const cardName = item.dataset.cardName
        this.selectCard(cards.find(c => c.name === cardName))
      })
    })

    // Close on outside click - use a more robust handler
    const closeHandler = (e) => {
      if (!resultsContainer.contains(e.target) && e.target.id !== 'card-search') {
        resultsContainer.classList.add('hidden')
        document.removeEventListener('click', closeHandler)
      }
    }
    setTimeout(() => {
      document.addEventListener('click', closeHandler)
    }, 0)
  }

  selectCard(card) {
    this.selectedCard = card
    document.getElementById('card-search').value = card.name
    document.getElementById('card-results').classList.add('hidden')
    this.updateUIState()
  }

  async handleBattlefieldCardSearch(query) {
    const resultsContainer = document.getElementById('battlefield-card-results')
    
    if (!query || query.length < 2) {
      resultsContainer.classList.add('hidden')
      return
    }

    scryfallService.debouncedSearch(query, (cards) => {
      this.displayBattlefieldCardResults(cards)
    })
  }

  displayBattlefieldCardResults(cards) {
    const resultsContainer = document.getElementById('battlefield-card-results')
    
    if (cards.length === 0) {
      resultsContainer.innerHTML = '<div class="p-3 text-sm text-gray-500 text-center">No cards found</div>'
      resultsContainer.classList.remove('hidden')
      return
    }

    resultsContainer.innerHTML = cards.map((card, index) => `
      <div 
        class="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 transition-colors battlefield-card-result-item ${index === 0 ? 'bg-blue-50' : ''}"
        data-card-id="${card.id}"
        data-card-name="${card.name}"
      >
        <div class="font-medium text-sm text-gray-900">${card.name}</div>
        <div class="text-xs text-gray-500 mt-0.5">${card.type_line}</div>
        ${card.mana_cost ? `<div class="text-xs text-gray-400 mt-1">${card.mana_cost}</div>` : ''}
      </div>
    `).join('')

    resultsContainer.classList.remove('hidden')

    // Add click handlers
    resultsContainer.querySelectorAll('.battlefield-card-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const cardName = item.dataset.cardName
        const card = cards.find(c => c.name === cardName)
        this.addToBattlefield(card)
      })
    })

    // Close on outside click
    const closeHandler = (e) => {
      if (!resultsContainer.contains(e.target) && e.target.id !== 'battlefield-card-search') {
        resultsContainer.classList.add('hidden')
        document.removeEventListener('click', closeHandler)
      }
    }
    setTimeout(() => {
      document.addEventListener('click', closeHandler)
    }, 0)
  }

  addToBattlefield(card) {
    this.scenario.currentState.addToBattlefield(card, this.currentPlayer)
    document.getElementById('battlefield-card-search').value = ''
    document.getElementById('battlefield-card-results').classList.add('hidden')
    this.updateBattlefieldDisplay()
    this.updateGameStateDisplay()
    this.updateURL()
  }

  removeFromBattlefield(cardName) {
    this.scenario.currentState.removeFromBattlefield(cardName, this.currentPlayer)
    this.updateBattlefieldDisplay()
    this.updateGameStateDisplay()
    this.updateURL()
  }

  updateBattlefieldDisplay() {
    const battlefieldList = document.getElementById('current-battlefield-list')
    const battlefield = this.scenario.currentState.getBattlefield(this.currentPlayer)
    
    if (battlefield.length === 0) {
      battlefieldList.innerHTML = '<p class="text-sm text-gray-400 text-center py-2">No permanents</p>'
      return
    }

    battlefieldList.innerHTML = battlefield.map((card, index) => {
      const cardName = typeof card === 'string' ? card : card.name
      const typeLine = typeof card === 'object' && card.type_line ? card.type_line : ''
      return `
        <div class="flex items-center justify-between p-2 bg-white rounded border border-gray-200 hover:border-gray-300">
          <div class="flex-1">
            <div class="font-medium text-sm text-gray-900">${cardName}</div>
            ${typeLine ? `<div class="text-xs text-gray-500">${typeLine}</div>` : ''}
          </div>
          <button 
            class="ml-2 text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 hover:bg-red-50 rounded"
            data-card-name="${cardName}"
            title="Remove from battlefield"
          >
            ×
          </button>
        </div>
      `
    }).join('')

    // Add remove handlers
    battlefieldList.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const cardName = btn.dataset.cardName
        this.removeFromBattlefield(cardName)
      })
    })
  }

  addTarget() {
    const targetName = prompt('Enter target name:')
    if (targetName && targetName.trim()) {
      this.targets.push({
        name: targetName.trim(),
        illegal: false,
      })
      this.updateTargetList()
    }
  }

  updateTargetList() {
    const targetList = document.getElementById('target-list')
    if (this.targets.length === 0) {
      targetList.innerHTML = '<p class="text-sm text-gray-400">No targets</p>'
      return
    }

    targetList.innerHTML = this.targets.map((target, index) => `
      <div class="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
        <span class="flex-1 text-sm text-gray-700">${target.name}</span>
        ${target.illegal ? '<span class="text-xs text-red-600 font-medium">Illegal</span>' : ''}
        <button 
          class="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 hover:bg-red-50 rounded"
          data-target-index="${index}"
          title="Remove target"
        >
          ×
        </button>
      </div>
    `).join('')

    // Add remove handlers
    targetList.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.targetIndex)
        this.targets.splice(index, 1)
        this.updateTargetList()
      })
    })
  }

  addActionToStack() {
    if (!this.selectedCard) {
      alert('Please select a card first')
      return
    }

    const actionType = document.getElementById('action-type').value
    const typeMap = {
      'cast-spell': 'spell',
      'activate-ability': 'ability',
      'triggered-ability': 'trigger',
    }

    const stackObject = new StackObject({
      controller: this.currentPlayer,
      type: typeMap[actionType],
      sourceCard: this.selectedCard,
      targets: [...this.targets],
    })

    this.scenario.currentState.addToStack(stackObject)
    
    // Reset form
    this.selectedCard = null
    this.targets = []
    document.getElementById('card-search').value = ''
    this.updateTargetList()
    this.updateUI()
  }

  respondToStack() {
    if (!this.selectedCard) {
      alert('Please select a card first')
      return
    }

    const actionType = document.getElementById('action-type').value
    const typeMap = {
      'cast-spell': 'spell',
      'activate-ability': 'ability',
      'triggered-ability': 'trigger',
    }

    const stackObject = new StackObject({
      controller: this.currentPlayer,
      type: typeMap[actionType],
      sourceCard: this.selectedCard,
      targets: [...this.targets],
    })

    this.scenario.currentState.respondToStack(stackObject)
    
    // Reset form
    this.selectedCard = null
    this.targets = []
    document.getElementById('card-search').value = ''
    this.updateTargetList()
    this.updateUI()
  }

  stepResolve() {
    const result = this.resolutionEngine.resolveTop()
    
    if (result.success && result.resolved !== false) {
      this.stackViz.highlightTop()
    }
    
    this.displayExplanation(result.explanation)
    this.updateUI()
    this.updateURL()
  }

  autoResolve() {
    const results = this.resolutionEngine.autoResolveAll()
    
    if (results.length > 0) {
      const lastExplanation = results[results.length - 1].explanation
      this.displayExplanation({
        title: 'Stack fully resolved',
        details: [
          `Resolved ${results.length} object(s) from the stack.`,
          ...(lastExplanation?.details || []),
        ],
        rules: lastExplanation?.rules || [],
      })
    }
    
    this.updateUI()
    this.updateURL()
  }

  resetScenario() {
    if (confirm('Are you sure you want to reset the scenario? All progress will be lost.')) {
      this.scenario.reset()
      this.selectedCard = null
      this.targets = []
      document.getElementById('card-search').value = ''
      this.updateTargetList()
      this.updateUI()
      this.updateURL()
    }
  }

  displayExplanation(explanation) {
    const panel = document.getElementById('explanation-panel')
    
    if (!explanation) {
      panel.innerHTML = '<p class="text-sm text-gray-400">Resolve actions to see explanations here.</p>'
      return
    }

    const detailsHtml = explanation.details
      ? explanation.details.map(d => `<p class="mb-2">${d}</p>`).join('')
      : ''

    const rulesHtml = explanation.rules && explanation.rules.length > 0
      ? `<div class="mt-4 pt-4 border-t border-gray-200">
           <h4 class="font-medium text-sm text-gray-700 mb-2">Rules References:</h4>
           <ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
             ${explanation.rules.map(r => `<li>${r}</li>`).join('')}
           </ul>
         </div>`
      : ''

    panel.innerHTML = `
      <h3 class="font-semibold text-lg text-gray-900 mb-3">${explanation.title || 'Explanation'}</h3>
      <div class="text-gray-700">
        ${detailsHtml}
      </div>
      ${rulesHtml}
    `
  }

  updateUI() {
    // Update stack visualization
    this.stackViz.render(this.scenario.currentState)

    // Update stack count
    const stackCount = document.getElementById('stack-count')
    const count = this.scenario.currentState.zones.stack.length
    stackCount.textContent = `${count} object${count !== 1 ? 's' : ''}`

    // Update battlefield display for current player
    this.updateBattlefieldDisplay()

    // Update game state display
    this.updateGameStateDisplay()

    // Update button states
    this.updateUIState()
  }

  updateGameStateDisplay() {
    const battlefield = document.getElementById('battlefield-list')
    const graveyard = document.getElementById('graveyard-list')

    // Show all players' battlefields
    const playerColors = {
      'A': { bg: 'bg-blue-600', text: 'text-blue-600' },
      'B': { bg: 'bg-red-600', text: 'text-red-600' },
      'C': { bg: 'bg-green-600', text: 'text-green-600' },
      'D': { bg: 'bg-purple-600', text: 'text-purple-600' },
    }

    let hasAnyBattlefield = false
    let battlefieldHtml = ''
    
    this.scenario.currentState.players.forEach(player => {
      const playerBattlefield = this.scenario.currentState.getBattlefield(player)
      if (playerBattlefield.length > 0) {
        hasAnyBattlefield = true
        const color = playerColors[player]
        battlefieldHtml += `
          <div class="mb-3">
            <div class="flex items-center gap-2 mb-1">
              <div class="w-3 h-3 ${color.bg} rounded-full"></div>
              <span class="text-xs font-medium ${color.text}">Player ${player}</span>
            </div>
            <div class="ml-5 space-y-1">
              ${playerBattlefield.map(card => {
                const cardName = typeof card === 'string' ? card : card.name
                return `<p class="text-xs text-gray-600">${cardName}</p>`
              }).join('')}
            </div>
          </div>
        `
      }
    })

    if (!hasAnyBattlefield) {
      battlefield.innerHTML = '<p class="text-gray-400 text-sm">No permanents</p>'
    } else {
      battlefield.innerHTML = battlefieldHtml
    }

    const graveyardItems = this.scenario.currentState.zones.graveyard
    if (graveyardItems.length === 0) {
      graveyard.innerHTML = '<p class="text-gray-400 text-sm">Empty</p>'
    } else {
      graveyard.innerHTML = graveyardItems
        .map(obj => `<p class="text-sm text-gray-600">${obj.cardName}</p>`)
        .join('')
    }
  }

  updateUIState() {
    const hasStack = this.scenario.currentState.zones.stack.length > 0
    const hasCard = this.selectedCard !== null

    document.getElementById('step-resolve-btn').disabled = !hasStack
    document.getElementById('auto-resolve-btn').disabled = !hasStack
    document.getElementById('add-action-btn').disabled = !hasCard
    document.getElementById('respond-btn').disabled = !hasCard || !hasStack
  }

  shareScenario() {
    const serialized = this.scenario.serialize()
    const url = new URL(window.location.href)
    url.searchParams.set('scenario', serialized)
    
    navigator.clipboard.writeText(url.toString()).then(() => {
      alert('Scenario link copied to clipboard!')
    }).catch(() => {
      // Fallback for browsers without clipboard API
      prompt('Copy this link:', url.toString())
    })
  }

  loadFromURL() {
    const urlParams = new URLSearchParams(window.location.search)
    const scenarioParam = urlParams.get('scenario')
    
    if (scenarioParam) {
      const loaded = Scenario.deserialize(scenarioParam)
      if (loaded) {
        this.scenario = loaded
        this.resolutionEngine = new ResolutionEngine(this.scenario.currentState)
        this.updateUI()
      }
    }
  }

  updateURL() {
    const serialized = this.scenario.serialize()
    const url = new URL(window.location.href)
    url.searchParams.set('scenario', serialized)
    window.history.replaceState({}, '', url)
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new StackAnalyzerApp()
  })
} else {
  new StackAnalyzerApp()
}
