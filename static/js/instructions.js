
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
      'min-height': 130,
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

  run(display, stage) {
    if (display) this.attach(display)
    if (stage == undefined && urlParams.instruct) {
      stage = parseInt(urlParams.instruct)
    }
    this.runStage(stage ?? 1)
    return this.completed
  }

  registerPromise(promise) {
    if (!promise.reject) {
      assert(false, "promise must have reject method")
    }
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
    this.rejectPromises()
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

  run(div) {
    this.attach(div)
    return this.done
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
  }

  getPuzzle(opts={}) {
    console.log('WHAT', this.params, opts)
    let mp = new MachinePuzzle({disableInvalid: false, ...this.params, ...opts })
    mp.book.hide()
    mp.goalBox.hide()
    mp.chemicalDiv.hide()
    mp.attach(this.content)
    $('.machine-div button').prop('disabled', true)
    return mp
  }

  async stage_welcome() {
    // this.instruct(`
    //   Thanks for participating! We'll start with some quick instructions.
    // `)

    let mp = this.getPuzzle()

    this.instruct(`
      Welcome! In this experiment, you will be synthesizing chemicals using
      a machine like the one below (this simple one is just for practice).
    `)
  }

  async stage_intro() {
    let mp = this.getPuzzle()
    window.foo = mp
    for (let i of _.range(mp.nChemical)) {
      mp.addChemical(i)
    }
    $('.machine-div button').prop('disabled', true)

    mp.chemicalDiv.show()

    this.instruct(`
      There are 3 different chemicals: X, Y, and Z.
    `)
  }

  async stage_stock() {
    let mp = this.getPuzzle()
    mp.addChemical(0)
    mp.chemicalDiv.show()
    $('.machine-div button').prop('disabled', true)

    this.instruct(`
      But on each round, you will start with only one chemical in stock.
    `)
  }

  async stage_goal() {
    let mp = this.getPuzzle({start: 0, goal: 1})
    mp.addChemical(0)
    mp.chemicalDiv.show()
    mp.goalBox.show()
    $('.machine-div button').prop('disabled', true)

    this.instruct(`
      Your job is to synthesize a **goal chemical**, in this case **chemical Y**.
    `)
  }

  async stage_example() {
    let mp = this.getPuzzle({start: 0, goal: 1, trialID: 'example-one'})
    mp.addChemical(0)
    mp.chemicalDiv.show()
    mp.goalBox.show()

    this.instruct(`
      You can synthesize other chemicals using the machine.
      Put **chemical X** in the machine by clicking on it.
    `)
    await this.eventPromise(`machine.activateChemical`)
    $('.chemical').prop('disabled', true)

    this.instruct(`
      Next, you enter the chemical you want to synthesize. Select **chemical Y**
      by clicking the button labeled Y.

    `)
    mp.targetEls[1].prop('disabled', false)
    await this.eventPromise(`machine.activateTarget`)

    this.instruct(`
      Finally, you enter a operation code. Try using **operation code 1**.
    `)
    mp.modeEls[0].prop('disabled', false)
    await this.eventPromise(`machine.activateMode.0`)

    this.instruct('Great! The machine is now ready to run. Pull the lever!')
    $('.mode').prop('disabled', true)

    await this.eventPromise('machine.addChemical')

    this.instruct('Well done!')
    $('.machine-div button').prop('disabled', true)
  }

  async stage_recipes() {
    let mp = this.getPuzzle()
    // mp.machineWrapper.hide()
    mp.chemicalDiv.show()
    mp.book.show()

    this.instruct(`
      To help you remember what you've learned about the machine, we'll keep an updated **manual** for you.
      Every time you discover a new transformation, we'll add it to the manual (we gave you an extra one for free).
    `)
  }


  async stage_example_failure() {
    let mp = this.getPuzzle({start: 0, goal: 2, trialID: 'example-failure'})
    mp.addChemical(0)
    mp.chemicalDiv.show()
    mp.goalBox.show()
    mp.book.show()

    this.instruct(`Let's try another one. Add **chemical X** to the machine.`)
    await this.eventPromise(`machine.activateChemical.0`)
    $('.chemical').prop('disabled', true)

    this.instruct(`Now try to synthesize **chemical Z**`)
    $('.target').prop('disabled', false)
    await this.eventPromise(`machine.activateTarget.2`)
    $('.target').prop('disabled', true)

    this.instruct(`Pick any **operation code**.`)
    $('.mode').prop('disabled', false)
    await this.eventPromise(`machine.activateMode`)

    this.instruct('Pull that lever!')
    await this.eventPromise('machine.result')

    this.instruct(`
      Oh... yuck. That didn't look good. It seems like you need to be careful
      about which operation mode you use.
    `)
    $('.machine-div button').prop('disabled', true)
  }

  async stage_example2() {
    let mp = this.getPuzzle({start: 0, goal: 2, trialID: 'example-twostep'})
    mp.addChemical(0)
    mp.chemicalDiv.show()
    mp.goalBox.show()
    mp.book.show()


    this.instruct(`
      Maybe it will be easier to do this one in two steps.
      Start by adding **chemical X** to the machine again.
    `)
    await this.eventPromise(`machine.activateChemical.0`)
    $('.chemical').prop('disabled', true)

    this.instruct(`
      Now see if you can synthesize **chemical Y**.

      *psst: don't forget about the manual!*
    `)
    $('.target').prop('disabled', false)
    $('.mode').prop('disabled', false)
    await this.eventPromise('machine.addChemical.1')

    this.instruct(`
      Awesome! Now you can add your newly synthesized **chemical Y** to the machine...
    `)
    await this.eventPromise('machine.activateChemical.1')

    this.instruct(`
      ...and you should be able to synthesize **chemical Z**.
    `)
    await this.eventPromise('machine.addChemical.2')

    this.instruct('Beautiful!')
  }

  async stage_invalid() {
    let mp = this.getPuzzle({start: 0, goal: 0, trialID: 'example-twostep', disableInvalid: true})
    mp.addChemical(2)
    mp.chemicalDiv.show()
    mp.goalBox.show()
    mp.book.show()

    this.instruct(`
      One last thing. There are some chemical transformations that the machine just can't perform.
      Try adding **chemical Z** to the machine.
    `)
    await this.eventPromise('machine.activateChemical.2')
    this.instruct(`
      You can see that the X and Y buttons are grayed out. This means it's not possible to synthesize
      chemical X or Y directly from chemical Z.
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
      ['What is the goal chemical on the previous screen? (You can check!)', ['X', 'Y', 'Z'], 'X'],
      // [`According to the manual, in mode ${mn} the machine will turn chemical ${cn1} into which chemical?`, mp.chemicalNames, cn2],
      [`According to the manual, which operation code should you enter to turn chemical Y into chemical Z?`, mp.modeNames, 3],
      ['You must synthesize the goal chemical directly from your starting chemical.' , ['true', 'false'], 'false'],
      ['The manual includes all possible chemical transformations.' , ['true', 'false'], 'false'],
      // ['Every chemical can be directly transformed into every other chemical.' , ['true', 'false'], 'true'],
      // ['A given mode always produces the same chemical, regardless of the input chemical.' , ['true', 'false'], 'false'],
    ])
    await this.registerPromise(this.quiz.run($("<div>").appendTo(this.prompt)))
  }

  async stage_final() {
    this.instruct(`
      You've finished the instructions, and are ready to move onto the main phase of the experiment.

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
