
class Instructions {
  constructor() {
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
      'min-height': 120,
      'margin': 'auto',
      'margin-bottom': 50,
    }).appendTo(this.div)

    this.content = $('<div>')
    .appendTo(this.div)
    .css('float', 'left')

    this.stage = 0
    this.maxStage = 0
    this.stages = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
    .filter(f => f.startsWith('stage_'))
    .map(f => this[f])

    this.completed = make_promise()

    this.promises = []

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

  registerPromise(promise) {
    this.promises.push(promise)
    return promise
  }

  eventPromise(...args) {
    return this.registerPromise(eventPromise(...args))
  }

  rejectPromises() {
    for (const promise of this.promises) {
      promise.reject()
    }
    this.promises = []
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
    this.maxStage = Math.max(this.maxStage, this.stage + 1)
    this.btnNext.prop('disabled', false)
  }
}



class Quiz {
  constructor(questions) {
    this.questions = questions
    this.div = $('<div>')
    this.done = make_promise()
    this.correct = []
    this.inputs = questions.map((q) => {
      this.correct.push(q[2])
      return radio_buttons(this.div, q[0], q[1])
    })
    this.button = $('<button>', {class: 'btn btn-primary'})
    .text('check answers')
    .appendTo(this.div)
    .click(() => this.check())
  }

  attach(div) {
    div.empty()
    this.div.appendTo(div)
    // not sure why we need to rebind this
    this.button.click(() => this.check())
  }

  async run(div) {
    this.attach(div)
    await this.done
  }

  check() {
    let answers = this.inputs.map(i => i.val())
    logEvent('quiz.check', {answers, correct: this.correct})
    let pass = _.every(_.zip(answers, this.correct), ([a, c]) => {
      return a == c
    })
    console.log('pass', pass)
    if (pass) {
      alert_success()
      this.done.resolve()
    } else {
      alert_failure({
        title: 'Try again',
        html: "Click the arrows at the top of the screen to review the instructions if needed."
      })
    }
  }
}


class MachineInstructions extends Instructions {
  constructor(params) {
    super()
    this.params = _.cloneDeep(params)
    window.instruct = this

    let mp = new MachinePuzzle(this.params)


    let {chem1, mode, chem2, chem3} = this.params.example
    Object.assign(this, {
      chem1, mode, chem2, chem3,
      cn1: mp.chemicalNames[chem1],
      cn2: mp.chemicalNames[chem2],
      cn3: mp.chemicalNames[chem3],
      mn: mp.modeNames[mode]
    })
  }

  getPuzzle(opts={}) {
    let mp = new MachinePuzzle({...this.params, ...opts})
    mp.attach(this.content)
    mp.book.hide()
    mp.goalBox.hide()
    mp.chemicalDiv.hide()
    $('.machine-div button').prop('disabled', true)
    return mp
  }

  async stage_welcome() {
    // this.instruct(`
    //   Thanks for participating! We'll start with some quick instructions.
    // `)

    let mp = this.getPuzzle()

    this.instruct(`
      Welcome! In this experiment, you will be using this machine to synthesize
      different chemicals.
    `)
  }

  async stage_intro() {
    let mp = this.getPuzzle()
    for (let i of _.range(mp.nChemical)) {
      mp.addChemical(i)
    }
    $('.machine-div button').prop('disabled', true)

    mp.chemicalDiv.show()

    this.instruct(`
      There are ${mp.nChemical} different chemicals, labeled A-${_.last(mp.chemicalNames)}.
    `)
  }

  async stage_stock() {
    let mp = this.getPuzzle()
    mp.addChemical(this.chem1)
    mp.chemicalDiv.show()
    $('.machine-div button').prop('disabled', true)

    this.instruct(`
      But on each round, you will start with only one chemical in stock.
    `)
  }

  async stage_example() {
    let mp = this.getPuzzle()
    mp.addChemical(this.chem1)
    mp.chemicalDiv.show()

    this.instruct(`
      You can synthesize other chemicals using the machine.
      The machine can transform each chemical to any other chemical.
      Put **chemical ${this.cn1}** in the machine by clicking on it.
    `)
    await this.eventPromise(`machine.activateChemical.${this.chem1}`)
    $('.chemical').prop('disabled', true)

    this.instruct(`
      Next, you enter the chemical you want to synthesize.
      Click the button labeled **${this.cn2}**.

    `)
    mp.targetEls[this.chem2].prop('disabled', false)
    await this.eventPromise(`machine.activateTarget`)

    this.instruct(`
      Finally, you enter a operation code. Try using **operation code ${this.mn}**.
    `)
    mp.modeEls[this.mode].prop('disabled', false)
    await this.eventPromise(`machine.activateMode.${this.mode}`)

    this.instruct('Great! The machine is now ready to run. Pull the lever!')
    $('.mode').prop('disabled', true)

    await this.eventPromise('machine.addChemical')

    this.instruct('Amazing! You synthesized a new chemical! It has been added to your stock.')
    $('.machine-div button').prop('disabled', true)
  }

  async stage_example2() {
    let mp = this.getPuzzle()
    mp.addChemical(this.chem1)
    mp.addChemical(this.chem2)
    mp.chemicalDiv.show()

    this.instruct(`Lets try another one. Add **chemical ${this.cn2}** to the machine.`)
    await this.eventPromise(`machine.activateChemical.${this.chem2}`)
    $('.chemical').prop('disabled', true)

    this.instruct(`Try to synthesize **chemical ${this.cn3}**`)
    $('.target').prop('disabled', false)
    await this.eventPromise(`machine.activateTarget.${this.chem3}`)
    $('.target').prop('disabled', true)

    this.instruct(`Now enter **operation code ${this.mn}** again.`)
    mp.modeEls[this.mode].prop('disabled', false)
    await this.eventPromise(`machine.activateMode.${this.mode}`)

    this.instruct('Pull that lever!')
    await this.eventPromise('machine.result')

    this.instruct(`
      Oh... yuck. That didn't look good. It seems like you need to be careful
      about which operation mode you use.
    `)
  }

  async stage_manual() {
    this.instruct(`
      But there's good news! The last machine operator created a
      complete manual for operating the machine!
    `)
  }

  async stage_manual2() {
    let mp = this.getPuzzle()
    mp.machineWrapper.hide()
    mp.book.show()

    this.instruct(`
      Unfortunately... we seem to have lost most of it. This is all we have left.
      Don't worry about memorizing it—it will always be available.
      Any time you discover a new chemical
      transformation, it will be added to the manual for future use.
    `)
  }

  async stage_7() {
    let mp = this.getPuzzle({start: 0, goal: PARAMS.nChemical-1})
    mp.addChemical(0)
    mp.goalBox.show()
    mp.chemicalDiv.show()
    mp.book.show()
    $('.machine-div button').prop('disabled', true)

    this.instruct(`
      On each round, your task is to synthesize a goal chemical starting with
      some other chemical. You can do it one step or multiple steps
      (first creating some other chemcial and then transforming it into chemical ${_.last(mp.chemicalNames)}).
    `)
  }

  async stage_quiz() {
    this.instruct(`
      Before moving on, let's make sure you understand how the machine works.
    `)

    let mp = new MachinePuzzle(this.params)
    let [c1, s, c2] = mp.recipes[0]
    let cn1 = mp.chemicalNames[c1]
    let cn2 = mp.chemicalNames[c2]
    let mn = mp.modeNames[s]


    this.quiz = this.quiz ?? new Quiz([  // use pre-existing quiz so answers are saved
      ['To complete each round, you need to synthesize the specified goal chemical.' , ['true', 'false'], 'true'],
      ['What is the goal chemical on the previous screen? (You can check!)' , mp.chemicalNames, _.last(mp.chemicalNames)],
      // [`According to the manual, in mode ${mn} the machine will turn chemical ${cn1} into which chemical?`, mp.chemicalNames, cn2],
      [`According to the manual, which operation code should you enter to turn chemical ${cn1} into chemical ${cn2}?`, mp.modeNames, this.mn],
      ['You must synthesize the goal chemical directly from your starting chemical.' , ['true', 'false'], 'false'],
      // ['Every chemical can be directly transformed into every other chemical.' , ['true', 'false'], 'true'],
      // ['A given mode always produces the same chemical, regardless of the input chemical.' , ['true', 'false'], 'false'],
    ])
    await this.registerPromise(this.quiz.run($("<div>").appendTo(this.prompt)))
  }

  async stage_final() {
    this.instruct(`
      That's it! In the rest of the experiment, you will
      complete ${this.params.tasks.length} rounds of chemical synthesis. Try to complete the experiment
      as quickly as you can. Good luck!

      <div class="alert alert-danger">
        <b>Warning!</b><br>
        Once you complete the instructions, <strong>you cannot refresh the page</strong>.
        If you do, you will get an error message and you won't be able to complete the
        study.
      </div>
    `)
    let question = 'Are you going to refresh the page after completing the instructions?'
    let radio = radio_buttons(this.prompt, question, ['yes', 'no'])
    let post = $('<div>').appendTo(this.prompt)
    let no = make_promise()
    let done = false
    radio.click((val) => {
      if (val == 'yes') {
        post.html("Haha... But seriously.")
      } else {
        no.resolve()
      }
    })
    await no
    radio.buttons().off()
    radio.buttons().prop('disabled', true)
    post.html('Good. No refreshing!')
    await this.button('finish instructions')
    this.runNext() // don't make them click the arrow
  }
}
