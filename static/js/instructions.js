
class Instructions {
  constructor(display) {
    this.div = $('<div>')
    .css({
      height: 800,
      width: 1000,
      // border: 'thick black solid',
      position: 'relative',
      margin: 'auto',
      padding: '10px',
      'user-select': 'none',
    })

    let help = $('<button>')
    .appendTo(this.div)
    .css({
      'position': 'absolute',
      'right': '-50px',
      'top': '10px'
    })
    .addClass('btn-help')
    .text('?')
    .click(async () => {
      await Swal.fire({
          title: 'Help',
          html: `
            Use the << and >> buttons to flip through the sections. You have
            to follow all the instructions on a page before you can advance to the next one.
            If you get stuck, try clicking << and then >> to start the section over.
          `,
          icon: 'info',
          confirmButtonText: 'Got it!',
        })
    })

    this.btnPrev = $('<button>')
    .addClass('btn')
    .text('<<')
    .css({
      position: 'absolute',
      top: '30px',
      left: '30px',
    })
    .click(() => this.runPrev())
    .prop('disabled', true)
    .appendTo(this.div)

    this.btnNext = $('<button>')
    .addClass('btn')
    .text('>>')
    .css({
      position: 'absolute',
      top: '30px',
      right: '30px',
    })
    .click(() => this.runNext())
    .prop('disabled', true)
    .appendTo(this.div)

    this.prompt = $('<div>').css({
      'max-width': 700,
      'height': 100,
      'margin': 'auto',
    }).appendTo(this.div)

    this.content = $('<div>').appendTo(this.div)

    this.stage = 0
    this.maxStage = 0
    this.stages = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
    .filter(f => f.startsWith('stage_'))
    .map(f => this[f])

    this.completed = make_promise()

  }

  attach(display) {
    display.empty()
    this.div.appendTo(display)
    return this
  }

  async run(display, stage) {
    if (display) this.attach(display)
    if (stage == undefined && urlParams.instruct) {
      stage = parseInt(urlParams.instruct)
    }
    this.runStage(stage ?? 1)
    await this.completed
  }

  sleep(ms) {
    // this allows us to cancel sleeps when the user flips to a new page
    this._sleep = make_promise()
    sleep(ms).then(() => this._sleep.resolve())
    return this._sleep
  }

  message(md) {
    this.prompt.html(markdown(md))
  }

  async button(text='continue', opts={}) {
    _.defaults(opts, {delay: 0})
    let btn = button(this.prompt, text, opts)
    await btn.clicked
    btn.remove()
  }

  instruct(md) {
    let prog = this.stage ? `(${this.stage}/${this.stages.length})` : ''
    this.message(`# Instructions ${prog}\n\n` + md)
  }

  async runStage(n) {
    this._sleep?.reject()
    this.prompt.empty()
    this.content.empty()
    this.content.css({opacity: 1}) // just to be safe
    logEvent(`instructions.runStage.${n}`)
    this.maxStage = Math.max(this.maxStage, n)
    this.stage = n
    this.btnNext.prop('disabled', this.stage >= this.maxStage)
    this.btnPrev.prop('disabled', this.stage <= 1)
    await this.stages[n-1].bind(this)()
    if (this.stage == n) {
      // check to make sure we didn't already move forward
      this.enableNext()
    }
  }

  runNext() {
    saveData()
    logEvent('instructions.runNext')
    this.btnNext.removeClass('btn-pulse')
    if (this.stage == this.stages.length) {
      logEvent('instructions.completed')
      psiturk.finishInstructions();
      this.completed.resolve()
      this.div.remove()
    } else {
      this.runStage(this.stage + 1)
    }
  }

  runPrev() {
    logEvent('instructions.runPrev')
    this.runStage(this.stage - 1)
  }

  enableNext() {
    this.btnNext.addClass('btn-pulse')
    this.maxStage = this.stage + 1
    this.btnNext.prop('disabled', false)
  }
}

class ExampleInstructions extends Instructions {
  constructor(trials) {
    super()
    this.trials = trials
    window.instruct = this
  }

  async stage_welcome() {
    // this.instruct(`
    //   Thanks for participating! We'll start with some quick instructions.
    // `)

    this.instruct(`
      In this experiment, you will do some things!
    `)
  }
}