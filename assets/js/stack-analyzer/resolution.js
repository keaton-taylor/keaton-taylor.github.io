/**
 * Resolution Engine
 * Handles step-by-step stack resolution, target legality, and fizzle detection
 */

import { StackObject } from './models.js'

export class ResolutionEngine {
  constructor(gameState) {
    this.gameState = gameState
  }

  /**
   * Check if all targets for a stack object are still legal
   */
  checkTargetLegality(stackObject) {
    // In MVP, we assume targets are legal unless explicitly marked
    // This is a simplified check - in a full implementation, we'd check:
    // - Target still exists
    // - Target still matches requirements
    // - Target hasn't gained protection/hexproof/shroud
    
    if (!stackObject.targets || stackObject.targets.length === 0) {
      return true // No targets means always legal
    }

    // Check if any target is marked as illegal
    const illegalTargets = stackObject.targets.filter(t => t.illegal === true)
    return illegalTargets.length === 0
  }

  /**
   * Resolve the top object on the stack
   * Returns explanation of what happened
   */
  resolveTop() {
    const top = this.gameState.topOfStack
    
    if (!top) {
      return {
        success: false,
        message: 'Stack is empty. Nothing to resolve.',
      }
    }

    // Check target legality
    const targetsLegal = this.checkTargetLegality(top)
    
    if (!targetsLegal) {
      // Fizzle - all targets illegal
      top.status = 'fizzled'
      this.gameState.removeFromStack(top.id)
      this.gameState.moveToGraveyard(top)
      
      return {
        success: true,
        resolved: false,
        object: top,
        explanation: this.generateFizzleExplanation(top),
      }
    }

    // Check if countered (simplified - in full implementation, we'd check for counterspells)
    if (top.status === 'countered') {
      this.gameState.removeFromStack(top.id)
      this.gameState.moveToGraveyard(top)
      
      return {
        success: true,
        resolved: false,
        object: top,
        explanation: this.generateCounterExplanation(top),
      }
    }

    // Resolve the object
    top.status = 'resolved'
    this.gameState.removeFromStack(top.id)
    
    // Move to appropriate zone
    if (top.type === 'spell') {
      // Instants and sorceries go to graveyard
      if (top.sourceCard?.type_line?.includes('Instant') || 
          top.sourceCard?.type_line?.includes('Sorcery')) {
        this.gameState.moveToGraveyard(top)
      } else {
        // Permanents go to battlefield of the controller
        this.gameState.addToBattlefield(top.sourceCard, top.controller)
      }
    } else {
      // Abilities don't go to graveyard, they just resolve
      // (In full implementation, we'd handle this differently)
    }

    return {
      success: true,
      resolved: true,
      object: top,
      explanation: this.generateResolutionExplanation(top),
    }
  }

  /**
   * Generate explanation for a fizzled spell
   */
  generateFizzleExplanation(stackObject) {
    const cardName = stackObject.cardName
    const controller = `Player ${stackObject.controller}`
    
    return {
      title: `${cardName} fizzled`,
      details: [
        `${controller}'s ${cardName} had all of its targets become illegal.`,
        'When a spell or ability has all of its targets become illegal, it is removed from the stack without resolving.',
        'This is called "fizzling" or "being countered by game rules".',
      ],
      rules: [
        'Rule 608.2b: If all targets are illegal, the spell or ability is countered.',
      ],
    }
  }

  /**
   * Generate explanation for a countered spell
   */
  generateCounterExplanation(stackObject) {
    const cardName = stackObject.cardName
    const controller = `Player ${stackObject.controller}`
    
    return {
      title: `${cardName} was countered`,
      details: [
        `${controller}'s ${cardName} was countered and removed from the stack.`,
        'Countered spells are moved to the graveyard without resolving.',
      ],
      rules: [
        'Rule 701.5a: To counter a spell or ability means to cancel it, removing it from the stack.',
      ],
    }
  }

  /**
   * Generate explanation for a resolved spell/ability
   */
  generateResolutionExplanation(stackObject) {
    const cardName = stackObject.cardName
    const controller = `Player ${stackObject.controller}`
    const type = stackObject.type === 'spell' ? 'spell' : 'ability'
    
    const details = [
      `${controller}'s ${cardName} resolved.`,
    ]

    if (stackObject.targets && stackObject.targets.length > 0) {
      const targetNames = stackObject.targets.map(t => t.name || 'target').join(', ')
      details.push(`It targeted: ${targetNames}.`)
    }

    if (stackObject.type === 'spell') {
      const typeLine = stackObject.sourceCard?.type_line || ''
      if (typeLine.includes('Instant') || typeLine.includes('Sorcery')) {
        details.push('As an instant or sorcery, it is moved to the graveyard after resolving.')
      } else {
        details.push('As a permanent spell, it enters the battlefield after resolving.')
      }
    }

    details.push('The stack resolves in Last-In-First-Out (LIFO) order, meaning the most recently added object resolves first.')

    return {
      title: `${cardName} resolved`,
      details,
      rules: [
        'Rule 608.1: When all players pass in succession, the top (most recently added) object on the stack resolves.',
        'Rule 608.2: When a spell or ability resolves, its controller carries out the instructions printed on it.',
      ],
    }
  }

  /**
   * Auto-resolve entire stack
   */
  autoResolveAll() {
    const results = []
    while (this.gameState.topOfStack) {
      const result = this.resolveTop()
      results.push(result)
    }
    return results
  }
}
