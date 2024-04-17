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

const isEven = (x) => x % 2 == 0


const alphabet = Array.from(Array(26)).map((e, i) => i + 65).map((x) => String.fromCharCode(x));

class MachinePuzzle {
  constructor(options = {}) {
    _.defaults(options, {
      nSpell: 8,
      nPotion: 4,
      transitions: [{"5":2,"0":3,"7":1},{"0":3,"4":0,"3":2},{"6":1,"7":3,"1":0},{"5":1,"4":2,"1":0}]
    })
    window.AP = this
    Object.assign(this, options)
    this.state = 0
    this.div = $("<div>").addClass('machine-div')
    this.chemicalNames = alphabet.slice(0, this.nPotion)
    this.spellNames = alphabet.slice(-this.nSpell)
    this.state = Array(this.nPotion).fill(false)
    this.activePotion = null
    this.activeSpell = null
    this.recipes = this.transitions
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
    let $spells = $("<div>").appendTo(this.div)
    this.spellEls = []
    this.spellNames.forEach((name, i) => {
      let el = $('<button>')
      .addClass('spell')
      .text(name)
      .appendTo($spells)
      .on('click', () => this.castSpell(i))
      .prop('disabled', true)
      this.spellEls.push(el)
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

    this.machine = $('<div>')
    .addClass('machine')
    .appendTo(this.workspace)


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

    let $chemicals = $("<div>").appendTo(this.div)
    this.chemicalEls = []
    this.chemicalNames.forEach((name, i) => {
      let el = $('<button>')
      .addClass('chemical')
      .text(name)
      .appendTo($chemicals)
      .on('click', () => this.activatePotion(i))
      this.chemicalEls.push(el)
    })

    this.book = $('<div>')
    .addClass('recipe-book')
    .appendTo(this.div)

    this.recipes.forEach((recipes, chemical) => {
      let col = $('<div>').addClass('recipe-column').appendTo(this.book)

      for (let [spell, result] of Object.entries(recipes)) {
        let recipe = $('<div>')
        .addClass('recipe')
        .appendTo(col)

        $("<span>")
        .addClass('chemical small')
        .text(this.chemicalNames[chemical])
        .appendTo(recipe)
        .css({backgroundColor: COLORS[chemical]})

        $("<span>")
        .text('+')
        .appendTo(recipe)

        $("<span>")
        .addClass('spell small')
        .text(this.spellNames[spell])
        .appendTo(recipe)

        $("<span>")
        .text('=')
        .appendTo(recipe)

        $("<span>")
        .addClass('chemical small')
        .text(this.chemicalNames[result])
        .appendTo(recipe)
        .css({backgroundColor: COLORS[result]})
      }
    })
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

  async activatePotion(a) {
    $('.spell').prop('disabled', false)
    logEvent('machine.activatePotion', {a})
    this.activePotion = a
    // $('.chemical').removeClass('active')
    await gsap.to(this.cauldron, {backgroundColor: a == null ? 'white' : COLORS[a], duration: .5}).play()
  }


  async castSpell(spell) {
    $('button').prop('disabled', true)

    logEvent('machine.castSpell', {spell})
    assert(this.activePotion != null)
    let result = this.transitions[this.activePotion][spell]
    console.log('result', result)

    let duration = 3
    gsap.fromTo(this.cauldron, {rotation: 0}, {
      rotation: 5*duration*360,
      duration,
      ease: "power1.inOut",
    });

    await sleep(1000 * (duration - 1))
    let backgroundColor = COLORS[result] ?? "#4B5702"
    await gsap.to(this.cauldron, {backgroundColor, duration: 1}).play()
    await sleep(1000)

    if (result != null) {
      this.state[result] = true
      gsap.to(this.chemicalEls[result], {backgroundColor, duration: .5})
      this.chemicalEls[result]?.prop('disabled', false)
    }
    await gsap.to(this.cauldron, {backgroundColor: 'white', duration: .5}).play()

    this.activePotion = null
    this.state.forEach((on, i) => {
      let el = this.chemicalEls[i]
      el.prop('disabled', !on)
    })



    // await this.cauldron.css({ backgroundColor: COLORS[result]});

  //   console.log('result', result)
  //   this.addPotion(result)
  //   this.activatePotion(null)

  }

}