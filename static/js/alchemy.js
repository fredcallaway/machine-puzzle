const COLORS = [
  "#e41a1c",
  "#377eb8",
  "#4daf4a",
  "#984ea3",
  "#ff7f00",
  "#FFEF33",
  "#f781bf",
  "#a65628",
]

class AlchemyPuzzle {
  constructor(options = {}) {
    _.defaults(options, {

    })
    window.AP = this
    Object.assign(this, options)
    this.state = 0
    this.$div = $("<div>").css('text-align', 'center')
    this.potionNames = ['Ag', 'Bo', 'Cr']
    this.spellNames = ['X', 'Y', 'Z']
    this.state = [false, false, false]
    this.activePotion = null
    this.activeSpell = null
    this.transitions = [
      {0: 0, 1: 1, 2: 2},
      {},
      {0: 0, 1: 1, 2: 2},
    ]
  }


  attach(display) {
    display.empty()
    this.$div.appendTo(display)
    return this
  }

  async run(display) {
    logEvent('alchemy.run')
    if (display) this.attach(display)
    this.build()
    this.addPotion(0)
  }

  build() {
    this.$spells = $("<div>").appendTo(this.$div)
    this.spellEls = []
    this.spellNames.forEach((name, i) => {
      let el = $('<button>')
      .addClass('spell')
      .text(name)
      .appendTo(this.$spells)
      .on('click', () => this.activateSpell(i))
      this.spellEls.push(el)
    })

    this.workspace = $("<div>")
    .css({
      'display': 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      'margin': 'auto',
      'width': '800px',
      'height': '200px'
    })
    .appendTo(this.$div)

    this.mixBtn = $('<button>')
    .text('mix')
    .addClass('mix-btn')
    .prop('disabled', true)
    .on('click', () => this.mix())
    .appendTo(this.workspace)

    this.$potions = $("<div>").appendTo(this.$div)
    this.potionEls = []
    this.potionNames.forEach((name, i) => {
      let el = $('<button>')
      .addClass('potion')
      .text(name)
      .appendTo(this.$potions)
      .on('click', () => this.activatePotion(i))
      this.potionEls.push(el)
    })
  }

  addPotion(i) {
    logEvent('alchemy.addPotion', {i})
    this.state[i] = true
    this.state.forEach((on, i) => {
      let el = this.potionEls[i]
      el.css({
        'background': on ? COLORS[i] : 'white',
      })
      el.prop('disabled', !on)
    })
  }

  activatePotion(a) {
    this.activePotion = a
    $('.potion').removeClass('active')
    if (a != null) {
      logEvent('alchemy.activatePotion', {a})
      this.potionEls[a].addClass('active')
    }
    this.checkMixReady()
  }

  activateSpell(a) {
    this.activeSpell = a
    $('.spell').removeClass('active')
    if (a != null) {
      logEvent('alchemy.activateSpell', {a})
      this.spellEls[a].addClass('active')
    }
    this.checkMixReady()
  }

  checkMixReady() {
    let ready = (this.activeSpell != null && this.activePotion != null)
    this.mixBtn.prop('disabled', !ready)
  }

  mix() {
    logEvent('alchemy.mix', _.pick(this, 'activeSpell', 'activePotion'))
    let result = this.transitions[this.activePotion][this.activeSpell]
    this.addPotion(result)
    this.activatePotion(null)
    this.activateSpell(null)

  }
}