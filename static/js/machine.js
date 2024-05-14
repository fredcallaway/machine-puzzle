// fbf8cc-fde4cf-ffcfd2-f1c0e8-cfbaf0-a3c4f3-90dbf4-8eecf5-98f5e1-b9fbc0
// ffadad-ffd6a5-fdffb6-caffbf-9bf6ff-a0c4ff-bdb2ff-ffc6ff-fffffc
// ff91d3-ad97ff-44ecff-71ffa0-fee95d


// const COLORS = "fbf8cc-fde4cf-ffcfd2-f1c0e8-cfbaf0-a3c4f3-90dbf4-8eecf5-98f5e1-b9fbc0"
const DEFAULT_COLORS = "3BAEE9-52e3e1-a0e426-fdf148-ffab00-f77976-f050ae-d883ff-927FFF".split("-").map(x=>"#"+x)
const TRASH_COLOR = "#4E6220"
const ALPHABET = Array.from(Array(26)).map((e, i) => i + 65).map((x) => String.fromCharCode(x));

const isEven = (x) => x % 2 == 0


class MachinePuzzle {
  constructor(options = {}) {
    _.defaults(options, {
      nMode: null,
      transitions: null,
      recipes: [],
      goal: null,
      start: null,
      delaySeconds: 2,
      colors: DEFAULT_COLORS,
      chemicalNames: ALPHABET,
      manualHeight: 250,
      modeNames: _.range(1, 30),
      trialID: randomUUID()
    })
    window.mp = this
    Object.assign(this, options)
    this.nChemical = this.transitions.length
    this.div = $("<div>").addClass('machine-div')
    this.chemicalNames = this.chemicalNames.slice(0, this.nChemical)
    this.modeNames = this.modeNames.slice(0, this.nMode)
    this.state = Array(this.nChemical).fill(false)
    this.activeChemical = null
    this.activeMode = null
    this.ready = false
    this.done = make_promise()
    this.build()
  }

  logEvent(event, info={}) {
    info.trialID = this.trialID
    logEvent(event, info)
  }

  attach(display) {
    display.empty()
    this.div.appendTo(display)
    return this
  }

  async run(display) {
    this.logEvent('machine.run', _.pick(this, ['goal', 'start', 'recipes', 'transitions']))
    this.addChemical(this.start)
    this.addChemical(7)
    if (display) this.attach(display)
    // this.activateChemical(0)
    // this.activateMode(0)
    // this.clickLever()
    await this.done
  }

  build() {
    this.div.css({
      // border: 'thin white solid', // fixes things for some bizarre reason
      transform: 'scale(1.2)',
      marginTop: 50,
      userSelect: 'none',
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
        backgroundColor: this.colors[this.goal],
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

    let $targets = $("<div>")
    .css({
      position: 'relative',
      marginTop: 100,
      'z-index': 2,
    })
    .appendTo(this.machine)
    this.targetEls = this.chemicalNames.map((name, i) => {
      return $('<button>')
      .addClass('target')
      .text(name)
      .appendTo($targets)
      .on('click', () => this.activateTarget(i))
      // .prop('disabled', true)
    })

    let $modes = $("<div>")
    .css({
      position: 'relative',
      marginTop: -10,
      'z-index': 2,
    })
    .appendTo(this.machine)

    this.modeEls = this.modeNames.map((name, i) => {
      return $('<button>')
      .addClass('mode')
      .text(name)
      .appendTo($modes)
      .on('click', () => this.activateMode(i))
      // .prop('disabled', true)
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
      .prop('disabled', true)

      this.chemicalEls.push(el)
    })

    this.book = $('<div>')
    .addClass('recipe-book')
    .appendTo(this.div)
    .css('height', this.manualHeight)
    .append(
      $('<p>').text("MANUAL").css({marginTop: -30, fontWeight: "bold", fontSize: 22})
    )

    this.recipes.forEach((recipe) => this.addRecipe(...recipe, true))
  }

  addRecipe(chemical, mode, result, init=false) {
    if (!init) {
      let old = _(this.recipes).some(([c,s,r]) => c == chemical && s == mode && r == result)
      if (old) return
      this.recipes.push([chemical, mode, result])
    }
    let recipe = $('<div>')
    .addClass('recipe')
    .appendTo(this.book)

    $("<button>")
    .prop('disabled', true)
    .addClass('chemical small')
    .text(this.chemicalNames[chemical])
    .appendTo(recipe)
    .css({backgroundColor: this.colors[chemical]})

    $("<button>")
    .prop('disabled', true)
    .addClass('mode small')
    .text(this.modeNames[mode])
    .appendTo(recipe)

    $("<button>")
    .prop('disabled', true)
    .addClass('chemical small')
    .text(this.chemicalNames[result])
    .appendTo(recipe)
    .css({backgroundColor: this.colors[result]})

  }

  async addChemical(i) {
    if (this.state[i]) return
    this.logEvent(`machine.addChemical.${i}`)
    this.state[i] = true

    this.chemicalEls[i]
      .addClass('acquired')
      .removeClass('unavailable')
      .css({'background': this.colors[i]})
      .prop('disabled', false)

    if (i == this.goal) {
      this.victory()
    }
  }

  async victory() {
    this.logEvent('machine.victory')
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
    // $('.mode').prop('disabled', false)
    $('.staged').remove()
    if (a == null) return
    this.logEvent(`machine.activateChemical.${a}`)
    this.activeChemical = a
    let el = $('<div>')
    .addClass('chemical staged')
    .text(this.chemicalNames[a])
    .appendTo(this.machine)
    .css({
      backgroundColor: this.colors[a],
      position: 'absolute',
      left: 45,
      top: 52,
    })
    this.checkState()
  }

  disableInvalidTargets() {
    let c = this.activeChemical
    if (c == null) return
    this.targetEls.map((el, i) => {
      if (this.transitions[c][i] == -1) {
        el.prop('disabled', true).addClass('disabled')
      } else {
        el.prop('disabled', false).removeClass('disabled')
      }
    })
  }

  activateTarget(i) {
    this.logEvent(`machine.activateTarget.${i}`)
    this.activeTarget = i
    $('.target.active').removeClass('active')
    this.targetEls[i].addClass('active')
    this.checkState()
  }

  activateMode(i) {
    this.logEvent(`machine.activateMode.${i}`)
    this.activeMode = i
    $('.mode.active').removeClass('active')
    this.modeEls[i].addClass('active')
    this.checkState()
  }

  async checkState() {
    if (this.activeTarget != null && this.activeChemical != null &&
        this.transitions[this.activeChemical][this.activeTarget] == -1) {
      logEvent('machine.invalid', {chemical: this.activeChemical, mode: this.activeMode, target: this.activeTarget})
      let el = this.targetEls[this.activeTarget]
      // el.addClass('invalid')
      this.activeTarget = null
      el.removeClass('active')
      // sleep(500).then(()=> el.removeClass('active invalid'))
      // this.activateMode(null)
    }
    this.disableInvalidTargets()
    this.ready = this.activeMode != null && this.activeChemical != null && this.activeTarget != null
    this.lever.css('cursor', this.ready ? 'pointer' : '')
  }

  async clickLever() {
    if (!this.ready) return
    this.logEvent('machine.execute', {chemical: this.activeChemical, mode: this.activeMode, target: this.activeTarget})

    // don't allow repeated pulls
    this.ready = false
    $('.machine-div button').prop('disabled', true)

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
    let result = this.transitions[this.activeChemical][this.activeTarget] == this.activeMode ? this.activeTarget : null
    let el = $('<div>')
    .addClass('chemical staged')
    .text(this.chemicalNames[result] ?? '')
    .appendTo(this.machine)
    .css({
      backgroundColor: this.colors[result] ?? TRASH_COLOR,
      position: 'absolute',
      left: 344,
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
      this.addChemical(result)
      this.addRecipe(this.activeChemical, this.activeMode, result)
    }
    this.logEvent('machine.result', {chemical: this.activeChemical, mode: this.activeMode, result, target: this.activeTarget})
    this.activeChemical = null
    this.activeMode = null
    this.activeTarget = null
    $('.active').removeClass('active')
    $('.mode:not(.small)').prop('disabled', false)
    $('.target:not(.small)').prop('disabled', false)
    $('.acquired').prop('disabled', false)
    this.checkState()
  }
}
