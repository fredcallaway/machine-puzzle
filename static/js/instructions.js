
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
      'margin-bottom': 50,
    }).appendTo(this.div)

    this.content = $('<div>')
    .appendTo(this.div)
    .css('border', 'thin white solid')  // why why why

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
  constructor(trials) {
    super()
    this.trials = trials
    window.instruct = this
  }

  getPuzzle(opts={goal: null}) {
    let mp = new MachinePuzzle(opts)
    mp.attach(this.content)
    mp.build()
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
      Welcome! In this experiment, you will be using this machine to create
      different *chemicals*.
    `)
  }

  async stage_1() {
    let mp = this.getPuzzle()
    for (let i of _.range(5)) {
      mp.addPotion(i)
    }
    mp.chemicalDiv.show()

    this.instruct(`
      There are 5 different chemicals, labeled A-E.
    `)
  }

  async stage_2() {
    let mp = this.getPuzzle()
    mp.addPotion(1)
    mp.chemicalDiv.show()


    this.instruct(`
      But on each round, you will only start with one.
    `)
  }

  async stage_3() {
    let mp = this.getPuzzle()
    mp.addPotion(1)
    mp.chemicalDiv.show()

    this.instruct(`
      The machine can transform each type of chemical to any other type.
      Put chemical B in the machine by clicking on it.
    `)
    await eventPromise('machine.activateChemical.1')

    this.instruct(`
      The machine has several different operation modes. Try activating **mode
      3** by clicking on the button labeled 3.
    `)
    $('.spell').prop('disabled', false)
    await eventPromise('machine.activateSpell.2')

    mp.transitions[1][2] = 3
    this.instruct('Great! The machine is now ready to run. Pull the lever!')
    $('.spell').prop('disabled', true)

    await eventPromise('machine.addPotion.3')

    this.instruct('Amazing! You synthesized a new chemical!')
  }

  async stage_4() {
    let mp = this.getPuzzle()
    mp.addPotion(1)
    mp.addPotion(3)
    mp.chemicalDiv.show()


    mp.transitions[3][2] = undefined


    this.instruct('Lets try another one. Add chemical D to the machine.')
    await eventPromise('machine.activateChemical.3')
    $('.chemical').prop('disabled', true)
    $('.spell').prop('disabled', false)

    this.instruct('Now activate **mode 3** again.')
    await eventPromise('machine.activateSpell.2')
    $('.spell').prop('disabled', true)

    this.instruct('Pull that lever!')
    await eventPromise('machine.result')

    this.instruct(`
      Oh... yuck. That didn't look good. It seems like you need to be careful
      about which mode you use for each input chemical.
    `)
  }

  async stage_5() {
    this.instruct(`
      But there's good news! The last machine operator created a
      complete manual for operating the machine! It turns out that **you
      can turn any chemcial into any other chemical**—you just have to know
      the right mode to set the machine to.
    `)
  }

  async stage_6() {
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
    let mp = this.getPuzzle({goal: 3, start: 1})
    mp.addPotion(1)
    mp.goalBox.show()
    mp.chemicalDiv.show()
    mp.book.show()
    $('.machine-div button').prop('disabled', true)

    this.instruct(`
      On each round, your task is to create a goal chemical starting with
      some other chemical. You can do it one step or multiple (for example,
      creating chemical A so that you can turn it into chemical D)—whichever
      seems easier!
    `)
  }

  async stage_quiz() {
    this.instruct(`
      Before moving on, let's make sure you understand how the machine works.
    `)
    let quiz = new Quiz([
      ['To complete each round, you need to create the specified goal chemical' , ['true', 'false'], 'true'],
      ['You must create the chemical directly from your starting chemical' , ['true', 'false'], 'false'],
      ['Every chemical can be transformed into every other chemical' , ['true', 'false'], 'true'],
      ['A given mode always produces the same chemical, regardless of the input chemical' , ['true', 'false'], 'false'],
    ])
    await quiz.run($("<div>").appendTo(this.prompt))
  }

  async stage_final() {
    // I suggest keeping something like this here to warn participants to not refresh

    this.instruct(`
      That's it! In the rest of the experiment, you will
      complete 10 rounds of chemical synthesis. Try to complete the experiment
      as quickly as you can. Good luck!

      <br><br>
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
