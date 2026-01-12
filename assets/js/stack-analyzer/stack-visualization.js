/**
 * Stack Visualization Component
 * Renders the stack in a vertical LIFO display
 */

export class StackVisualization {
  constructor(containerId) {
    this.container = document.getElementById(containerId)
    if (!this.container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }
  }

  render(gameState) {
    const stack = gameState.zones.stack
    const topOfStack = gameState.topOfStack

    // Clear container
    this.container.innerHTML = ''

    if (stack.length === 0) {
      this.container.innerHTML = `
        <div class="text-center text-gray-400 py-8">
          Stack is empty. Add actions to build a scenario.
        </div>
      `
      return
    }

    // Render stack objects (bottom to top, but visually reversed)
    stack.forEach((stackObject, index) => {
      const isTop = index === stack.length - 1
      const element = this.createStackObjectElement(stackObject, isTop, index)
      this.container.appendChild(element)
    })
  }

  createStackObjectElement(stackObject, isTop, index) {
    const element = document.createElement('div')
    element.className = `stack-object p-4 rounded-lg border-2 transition-all ${
      isTop 
        ? 'bg-blue-50 border-blue-500 shadow-lg ring-2 ring-blue-200' 
        : 'bg-white border-gray-300 hover:border-gray-400'
    }`
    element.dataset.stackObjectId = stackObject.id

    const playerColors = {
      'A': 'bg-blue-600',
      'B': 'bg-red-600',
      'C': 'bg-green-600',
      'D': 'bg-purple-600',
    }
    const controllerBg = playerColors[stackObject.controller] || 'bg-gray-600'

    let targetsHtml = ''
    if (stackObject.targets && stackObject.targets.length > 0) {
      const targetList = stackObject.targets
        .map(t => `<span class="inline-block px-2 py-1 bg-gray-100 rounded text-xs">${t.name || 'target'}</span>`)
        .join(' ')
      targetsHtml = `<div class="mt-2 text-sm text-gray-600">Targets: ${targetList}</div>`
    }

    const statusBadge = this.getStatusBadge(stackObject.status)

    element.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <div class="w-3 h-3 ${controllerBg} rounded-full"></div>
            <span class="font-semibold text-gray-900">${stackObject.cardName}</span>
            ${isTop ? '<span class="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">TOP</span>' : ''}
          </div>
          <div class="text-xs text-gray-500 mb-1">
            ${this.getTypeLabel(stackObject.type)} • Player ${stackObject.controller}
          </div>
          ${targetsHtml}
          ${stackObject.notes ? `<div class="mt-1 text-xs text-gray-500 italic">${stackObject.notes}</div>` : ''}
        </div>
        <div class="ml-4">
          ${statusBadge}
        </div>
      </div>
    `

    return element
  }

  getTypeLabel(type) {
    const labels = {
      spell: 'Spell',
      ability: 'Activated Ability',
      trigger: 'Triggered Ability',
    }
    return labels[type] || type
  }

  getStatusBadge(status) {
    const badges = {
      pending: '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">Pending</span>',
      resolved: '<span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Resolved</span>',
      fizzled: '<span class="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">Fizzled</span>',
      countered: '<span class="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">Countered</span>',
    }
    return badges[status] || ''
  }

  highlightTop() {
    const topElement = this.container.querySelector('.stack-object:last-child')
    if (topElement) {
      topElement.classList.add('animate-pulse')
      setTimeout(() => {
        topElement.classList.remove('animate-pulse')
      }, 1000)
    }
  }
}
