/**
 * Data models for StackSense
 */

export class StackObject {
  constructor({
    id,
    controller,
    type,
    sourceCard,
    targets = [],
    status = 'pending',
    xValue = null,
    notes = '',
  }) {
    this.id = id || `stack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.controller = controller // 'A', 'B', 'C', or 'D'
    this.type = type // 'spell' | 'ability' | 'trigger'
    this.sourceCard = sourceCard // Card object from Scryfall
    this.targets = targets // Array of target objects
    this.status = status // 'pending' | 'resolved' | 'fizzled' | 'countered'
    this.xValue = xValue
    this.notes = notes
  }

  get cardName() {
    return this.sourceCard?.name || 'Unknown Card'
  }

  get isCounterable() {
    // Instants and sorceries are counterable
    return this.type === 'spell' && 
           (this.sourceCard?.type_line?.includes('Instant') || 
            this.sourceCard?.type_line?.includes('Sorcery'))
  }

  toJSON() {
    return {
      id: this.id,
      controller: this.controller,
      type: this.type,
      sourceCard: {
        name: this.sourceCard?.name,
        type_line: this.sourceCard?.type_line,
        oracle_text: this.sourceCard?.oracle_text,
        scryfall_id: this.sourceCard?.id,
      },
      targets: this.targets,
      status: this.status,
      xValue: this.xValue,
      notes: this.notes,
    }
  }

  static fromJSON(json) {
    return new StackObject(json)
  }
}

export class GameState {
  constructor() {
    this.players = ['A', 'B', 'C', 'D']
    this.zones = {
      battlefield: {
        A: [],
        B: [],
        C: [],
        D: [],
      },
      graveyard: [],
      stack: [],
    }
    this.assumptions = [
      'All targets are legal unless marked otherwise',
      'No replacement effects apply',
      'Basic trigger timing only',
      '4-player cEDH game',
      'Priority passes in turn order (A→B→C→D)',
    ]
    this.actionLog = []
  }

  addToStack(stackObject) {
    this.zones.stack.push(stackObject)
    this.actionLog.push({
      type: 'add_to_stack',
      object: stackObject.toJSON(),
      timestamp: Date.now(),
    })
  }

  respondToStack(stackObject) {
    // Insert above the current top (at the end of array)
    this.zones.stack.push(stackObject)
    this.actionLog.push({
      type: 'respond',
      object: stackObject.toJSON(),
      timestamp: Date.now(),
    })
  }

  get topOfStack() {
    return this.zones.stack[this.zones.stack.length - 1] || null
  }

  removeFromStack(stackObjectId) {
    const index = this.zones.stack.findIndex(obj => obj.id === stackObjectId)
    if (index !== -1) {
      const removed = this.zones.stack.splice(index, 1)[0]
      this.actionLog.push({
        type: 'remove_from_stack',
        objectId: stackObjectId,
        timestamp: Date.now(),
      })
      return removed
    }
    return null
  }

  moveToGraveyard(stackObject) {
    this.zones.graveyard.push(stackObject)
    this.actionLog.push({
      type: 'move_to_graveyard',
      object: stackObject.toJSON(),
      timestamp: Date.now(),
    })
  }

  addToBattlefield(card, player) {
    if (!this.zones.battlefield[player]) {
      this.zones.battlefield[player] = []
    }
    this.zones.battlefield[player].push(card)
    this.actionLog.push({
      type: 'add_to_battlefield',
      card: card,
      player: player,
      timestamp: Date.now(),
    })
  }

  removeFromBattlefield(cardName, player) {
    if (!this.zones.battlefield[player]) {
      return null
    }
    const index = this.zones.battlefield[player].findIndex(
      c => (typeof c === 'string' ? c : c.name) === cardName
    )
    if (index !== -1) {
      const removed = this.zones.battlefield[player].splice(index, 1)[0]
      this.actionLog.push({
        type: 'remove_from_battlefield',
        card: removed,
        player: player,
        timestamp: Date.now(),
      })
      return removed
    }
    return null
  }

  getBattlefield(player) {
    return this.zones.battlefield[player] || []
  }

  toJSON() {
    return {
      players: this.players,
      zones: {
        battlefield: this.zones.battlefield,
        graveyard: this.zones.graveyard.map(obj => obj.toJSON()),
        stack: this.zones.stack.map(obj => obj.toJSON()),
      },
      assumptions: this.assumptions,
      actionLog: this.actionLog,
    }
  }

  static fromJSON(json) {
    const state = new GameState()
    state.players = json.players || state.players
    
    // Handle both old format (array) and new format (object per player)
    if (json.zones?.battlefield) {
      if (Array.isArray(json.zones.battlefield)) {
        // Old format - migrate to new format (assign all to player A for backwards compat)
        state.zones.battlefield.A = json.zones.battlefield
      } else {
        // New format
        state.zones.battlefield = {
          A: json.zones.battlefield.A || [],
          B: json.zones.battlefield.B || [],
          C: json.zones.battlefield.C || [],
          D: json.zones.battlefield.D || [],
        }
      }
    }
    
    state.zones.graveyard = (json.zones?.graveyard || []).map(obj => StackObject.fromJSON(obj))
    state.zones.stack = (json.zones?.stack || []).map(obj => StackObject.fromJSON(obj))
    state.assumptions = json.assumptions || state.assumptions
    state.actionLog = json.actionLog || []
    return state
  }
}

export class Scenario {
  constructor() {
    this.initialState = new GameState()
    this.currentState = new GameState()
    this.resolutionHistory = []
  }

  reset() {
    this.currentState = new GameState()
    this.resolutionHistory = []
  }

  toJSON() {
    return {
      initialState: this.initialState.toJSON(),
      currentState: this.currentState.toJSON(),
      resolutionHistory: this.resolutionHistory,
    }
  }

  static fromJSON(json) {
    const scenario = new Scenario()
    scenario.initialState = GameState.fromJSON(json.initialState || {})
    scenario.currentState = GameState.fromJSON(json.currentState || {})
    scenario.resolutionHistory = json.resolutionHistory || []
    return scenario
  }

  serialize() {
    return btoa(JSON.stringify(this.toJSON()))
  }

  static deserialize(encoded) {
    try {
      const json = JSON.parse(atob(encoded))
      return Scenario.fromJSON(json)
    } catch (e) {
      console.error('Failed to deserialize scenario:', e)
      return null
    }
  }
}
