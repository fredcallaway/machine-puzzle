const COLORS = [
  "#ff91d3",
  "#ad97ff",
  "#44ecff",
  "#71ffa0",
  "#fee95d",
]

const TRASH_COLOR = "#4E6220"

const isEven = (x) => x % 2 == 0


const alphabet = Array.from(Array(26)).map((e, i) => i + 65).map((x) => String.fromCharCode(x));

class MachinePuzzle {
  constructor(options = {}) {
    _.defaults(options, {
      nSpell: 8,
      nPotion: 5,
      transitions: [{"5":2,"0":3,"7":1},{"0":3,"4":0,"3":2},{"6":1,"7":3,"1":0},{"5":1,"4":2,"1":0}],
      recipes: [],
      goal: null,
      start: null,
      delaySeconds: 2
    })
    window.AP = this
    Object.assign(this, options)
    this.trialId = randomUUID()
    this.div = $("<div>").addClass('machine-div')
    this.chemicalNames = alphabet.slice(0, this.nPotion)
    this.spellNames = _.range(1, this.nSpell + 1)
    this.state = Array(this.nPotion).fill(false)
    this.activeChemical = null
    this.activeSpell = null
    this.ready = false
    this.done = make_promise()
    this.build()
  }

  logEvent(event, info={}) {
    info.trialId = this.trialId
    logEvent(event, info)
  }

  attach(display) {
    display.empty()
    this.div.appendTo(display)
    return this
  }

  async run(display) {
    this.logEvent('machine.run', _.pick(this, ['goal', 'start', 'recipes', 'transitions']))
    console.log('this.start', this.start)
    this.addPotion(this.start)
    if (display) this.attach(display)
    // this.activateChemical(0)
    // this.activateSpell(0)
    // this.clickLever()
    await this.done
  }

  build() {
    this.div.css({
      // border: 'thin white solid', // fixes things for some bizarre reason
      transform: 'scale(1.2)',
      marginTop: 50
    })

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

    this.goalBox = $("<div>")
    .css({
      position: 'absolute',
      left: 50,
      top: 50,
      width: 100,
      height: 100,
      border: 'thick black solid'
    })
    .append(
      $('<p>').text("GOAL").css({marginTop: -30, fontWeight: "bold", fontSize: 22})
    )
    .append(
      $('<div>')
      .addClass('chemical')
      .css({
        backgroundColor: COLORS[this.goal],
        transform: 'scale(1.5)',
        marginTop: 13
      })
      .text(this.chemicalNames[this.goal])
    )
    .appendTo(this.workspace)

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
    addPanel(49, 0, 50, 52)
    addPanel(49, 449, 51, 52)
    addPanel(49, 100, 300, 52)

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

    this.chemicalDiv = $("<div>").appendTo(this.div)
    this.chemicalEls = []
    this.chemicalNames.forEach((name, i) => {
      let el = $('<button>')
      .addClass('chemical unavailable')
      .text(name)
      .appendTo(this.chemicalDiv)
      .on('click', () => this.activateChemical(i))
      this.chemicalEls.push(el)
    })

    this.book = $('<div>')
    .addClass('recipe-book')
    .appendTo(this.div)
    .append(
      $('<p>').text("MANUAL").css({marginTop: -30, fontWeight: "bold", fontSize: 22})
    )

    this.recipes.forEach((recipe) => this.addRecipe(...recipe, true))
  }

  addRecipe(chemical, spell, result, init=false) {
    if (!init) {
      let old = _(this.recipes).some(([c,s,r]) => c == chemical && s == spell && r == result)
      if (old) return
      this.recipes.push([chemical, spell, result])
    }
    let recipe = $('<div>')
    .addClass('recipe')
    .appendTo(this.book)

    $("<button>")
    .prop('disabled', true)
    .addClass('chemical small')
    .text(this.chemicalNames[chemical])
    .appendTo(recipe)
    .css({backgroundColor: COLORS[chemical]})

    $("<span>")
    .text('+')
    .appendTo(recipe)

    $("<button>")
    .prop('disabled', true)
    .addClass('spell small')
    .text(this.spellNames[spell])
    .appendTo(recipe)

    $("<span>")
    .html('&#8594;')
    .appendTo(recipe)

    $("<button>")
    .prop('disabled', true)
    .addClass('chemical small')
    .text(this.chemicalNames[result])
    .appendTo(recipe)
    .css({backgroundColor: COLORS[result]})
  }

  async addPotion(i) {
    if (this.state[i]) return
    this.logEvent(`machine.addPotion.${i}`)
    this.state[i] = true

    this.chemicalEls[i]
      .addClass('acquired')
      .removeClass('unavailable')
      .css({'background': COLORS[i]})
      .prop('disabled', false)

    if (i == this.goal) {
      this.victory()
    }
  }

  async victory() {
    // checkmark on goal
    $("<p>").html("&#x2713")
    .css({
      position: 'absolute',
      fontSize: 200,
      top: -140,
      // marginTop: -200,
      zIndex: 5,
    })
    .appendTo(this.goalBox)

    // party parrot
    $("<img>", {src: "static/img/parrot.gif"})
    .css({
      position: 'absolute',
      left: 0,
      top: -53,
      width: 50,
      zIndex: 10,
    })
    .appendTo(this.goalBox)

    await alert_success()
    this.done.resolve()

  }

  async activateChemical(a) {
    // $('.spell').prop('disabled', false)
    $('.staged').remove()
    if (a == null) return
    this.logEvent(`machine.activateChemical.${a}`)
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
    this.logEvent(`machine.activateSpell.${i}`)
    this.activeSpell = i
    $('.active').removeClass('active')
    this.spellEls[i].addClass('active')
    this.checkReady()
  }

  checkReady() {
    this.ready = this.activeSpell != null && this.activeChemical != null
    console.log('this.ready', this.ready)
    this.lever.css('cursor', this.ready ? 'pointer' : '')
  }

  async clickLever() {
    if (!this.ready) return
    this.logEvent('machine.execute', {chemical: this.activeChemical, spell: this.activeSpell})

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
    .addClass('chemical staged')
    .text(this.chemicalNames[result] ?? '')
    .appendTo(this.machine)
    .css({
      backgroundColor: COLORS[result] ?? TRASH_COLOR,
      position: 'absolute',
      left: 345,
      top: 52,
    })

    // delay, flashing light
    let elapsed = 0
    while (elapsed < 1000 * this.delaySeconds) {
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
    if (result != null) {
      this.addPotion(result)
      this.addRecipe(this.activeChemical, this.activeSpell, result)
    }
    this.logEvent('machine.result', {chemical: this.activeChemical, spell: this.activeSpell, result})
    this.activeChemical = null
    this.activeSpell = null
    $('.active').removeClass('active')
    $('.spell:not(.small)').prop('disabled', false)
    $('.acquired').prop('disabled', false)
    this.checkReady()
  }
}
