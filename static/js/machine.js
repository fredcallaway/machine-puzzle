const COLORS = [
  // "#e41a1c",
  "#377eb8",
  "#4daf4a",
  "#984ea3",
  "#ff7f00",
  "#FFEF33",
  "#f781bf",
  "#a65628",
]

const isEven = (x) => x % 2 == 0


const alphabet = Array.from(Array(26)).map((e, i) => i + 65).map((x) => String.fromCharCode(x));

class MachinePuzzle {
  constructor(options = {}) {
    _.defaults(options, {
      nSpell: 8,
      nPotion: 4,
      transitions: [{"5":2,"0":3,"7":1},{"0":3,"4":0,"3":2},{"6":1,"7":3,"1":0},{"5":1,"4":2,"1":0}],
      recipes: [[0, 5, 2], [0, 0, 3], [0, 0, 3], [0, 0, 3], [0, 0, 3]]
    })
    window.AP = this
    Object.assign(this, options)
    this.state = 0
    this.div = $("<div>").addClass('machine-div')
    this.chemicalNames = alphabet.slice(0, this.nPotion)
    this.spellNames = _.range(1, this.nSpell + 1)
    this.state = Array(this.nPotion).fill(false)
    this.activeChemical = null
    this.activeSpell = null
    this.ready = false
  }

  attach(display) {
    display.empty()
    this.div.appendTo(display)
    return this
  }

  async run(display) {
    logEvent('machine.run')
    if (display) this.attach(display)
    this.build()
    this.addPotion(0)
  }

  build() {
    this.workspace = $("<div>")
    .css({
      'display': 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      'margin': 'auto',
      // 'width': '800px',
      // 'height': '200px'
    })
    .appendTo(this.div)

    this.machineWrapper = $('<div>')
    .css({position: 'relative'})
    // .css('border', 'thin red solid')
    .appendTo(this.workspace)

    this.machine = $('<div>')
    .addClass('machine')
    .appendTo(this.machineWrapper)

    let addPanel = (top, left, width, height) => {
      $('<div>')
      .addClass('machine-panel')
      .css({top, left, width, height})
      .appendTo(this.machine)
    }
    addPanel(0, 0, 500, 50)
    addPanel(100, 0, 500, 100)
    addPanel(50, 0, 50, 50)
    addPanel(50, 449, 51, 50)
    addPanel(50, 100, 300, 50)

    let $spells = $("<div>")
    .css({
      position: 'relative',
      marginTop: 120,
      'z-index': 2,
    })
    .appendTo(this.machine)

    this.spellEls = []
    this.spellNames.forEach((name, i) => {
      let el = $('<button>')
      .addClass('spell')
      .text(name)
      .appendTo($spells)
      .on('click', () => this.activateSpell(i))
      // .prop('disabled', true)
      this.spellEls.push(el)
    })

    this.inbox = $('<div>')
    .css({
      left: 50,
      top: 50,
    })
    .addClass('box')
    .append(
      $('<p>').text("IN").css({marginTop: -25, fontWeight: "bold"})
    )
    .appendTo(this.machine)

    this.outbox = $('<div>')
    .css({
      right: 50,
      top: 50,
    })
    .addClass('box')
    .append(
      $('<p>').text("OUT").css({marginTop: -25, fontWeight: "bold"})
    )
    .appendTo(this.machine)

    // Create the lever
    this.lever = $('<div>').css({
        width: '100px',
        height: '10px',
        backgroundColor: 'gray',
        position: 'absolute',
        transform: 'rotate(-30deg)',
        transition: 'transform 0.5s ease',
        // marginLeft: 500,
        // zIndex: -1,
        right: -95,
        top: 75,
        transformOrigin: 'left center'
    })
    .appendTo(this.machineWrapper)

    // Create the handle
    $('<div>').css({
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        backgroundColor: "#EB0506",
        position: 'absolute',
        right: -2,
        top: '-5px'
    }).appendTo(this.lever)

    this.lever.on('click', () => {
      this.clickLever()
    });

    this.progressButton = $('<div>')
    .css({
      position: 'absolute',
      top: 10,
      right: 10,
      width: 15,
      height: 15,
      zIndex: 10,
    })
    .addClass('progress-button')
    .appendTo(this.machine)

    let $chemicals = $("<div>").appendTo(this.div)
    this.chemicalEls = []
    this.chemicalNames.forEach((name, i) => {
      let el = $('<button>')
      .addClass('chemical')
      .text(name)
      .appendTo($chemicals)
      .on('click', () => this.activateChemical(i))
      this.chemicalEls.push(el)
    })

    this.book = $('<div>')
    .addClass('recipe-book')
    .appendTo(this.div)

    this.recipes.forEach((recipe) => this.addRecipe(...recipe))
  }

  addRecipe(chemical, spell, result) {
    let recipe = $('<div>')
    .addClass('recipe')
    .appendTo(this.book)

    $("<button>")
    .addClass('chemical small')
    .text(this.chemicalNames[chemical])
    .appendTo(recipe)
    .css({backgroundColor: COLORS[chemical]})

    $("<span>")
    .text('+')
    .appendTo(recipe)

    $("<button>")
    .addClass('spell small')
    .text(this.spellNames[spell])
    .appendTo(recipe)

    $("<span>")
    .html('&#8594;')
    .appendTo(recipe)

    $("<button>")
    .addClass('chemical small')
    .text(this.chemicalNames[result])
    .appendTo(recipe)
    .css({backgroundColor: COLORS[result]})
  }

  addPotion(i) {
    logEvent('machine.addPotion', {i})
    this.state[i] = true
    this.state.forEach((on, i) => {
      let el = this.chemicalEls[i]
      el.css({
        'background': on ? COLORS[i] : 'white',
      })
      el.prop('disabled', !on)
    })
  }

  async activateChemical(a) {
    // $('.spell').prop('disabled', false)
    $('.staged').remove()
    if (a == null) return
    logEvent('machine.activateChemical', {a})
    this.activeChemical = a
    let el = $('<div>')
    .addClass('chemical staged')
    .text(this.chemicalNames[a])
    .appendTo(this.machine)
    .css({
      backgroundColor: COLORS[a],
      position: 'absolute',
      left: 45,
      top: 52,
    })
    this.checkReady()
  }

  activateSpell(i) {
    logEvent('machine.activateSpell', {i})
    this.activeSpell = i
    $('.active').removeClass('active')
    this.spellEls[i].addClass('active')
    this.checkReady()
  }

  checkReady() {
    this.ready = this.activeSpell != null && this.activeChemical != null
    console.log('this.ready', this.ready)
  }

  async clickLever() {
    if (!this.ready) return
    logEvent('machine.run', {chemical: this.activateChemical, spell: this.activeSpell})

    // don't allow repeated pulls
    this.ready = false
    $('button').prop('disabled', true)

    // animate lever
    this.lever.css({transform: 'rotate(30deg)'})
    await sleep(500)

    // animate sliding into machine
    $('.staged').css({
      transform: 'translate(50px)',
      transition: 'transform 1s ease-in',
    })
    await sleep(1000)

    // create result chemical
    let result = this.transitions[this.activeChemical][this.activeSpell]
    let el = $('<div>')
    .addClass('chemical foobar')
    .text(this.chemicalNames[result] ?? '')
    .appendTo(this.machine)
    .css({
      backgroundColor: COLORS[result] ?? "#4B5702",
      position: 'absolute',
      left: 345,
      top: 52,
    })

    // delay, flashing light
    let elapsed = 0
    while (elapsed < 3000) {
      elapsed += 1000
      this.progressButton.addClass('red')
      await sleep(500)
      this.progressButton.removeClass('red')
      await sleep(500)
    }
    this.progressButton.addClass(result == null ? "red" : "green")

    // new chemical appears
    el.css({
      transform: 'translate(50px)',
      transition: 'transform 1s ease-in',
    })
    await sleep(2000)

    this.progressButton.removeClass('red green')
    this.lever.css({transform: 'rotate(-30deg)'})
    await sleep(500)

    el.remove()
    this.addPotion(result)
    this.activeChemical = null
    this.activeSpell = null
    $('.active').removeClass('active')
  }
}