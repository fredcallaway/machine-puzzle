class Instructions {
  constructor(options = {}) {
    _.assign(
      this,
      {
        height: 800,
        promptWidth: 700,
        promptHeight: 130,
        contentWidth: 1200,
      },
      options
    )
    this.width = Math.max(this.promptWidth, this.contentWidth)

    this.div = $("<div>").css({
      height: this.height,
      width: this.width,
      // border: 'thick black solid',
      position: "relative",
      margin: "auto",
      padding: "10px",
      "user-select": "none",
    })

    let help = $("<button>")
      .appendTo(this.div)
      .css({
        position: "absolute",
        right: "-50px",
        top: "10px",
      })
      .addClass("btn-help")
      .text("?")
      .click(async () => {
        await Swal.fire({
          title: "Help",
          html: `
            Use the << and >> buttons to flip through the sections. You have
            to follow all the instructions on a page before you can advance to the next one.
            If you get stuck, try clicking << and then >> to start the section over.
          `,
          icon: "info",
          confirmButtonText: "Got it!",
        })
      })

    this.btnPrev = $("<button>")
      .addClass("btn")
      .text("<<")
      .css({
        position: "absolute",
        top: "30px",
        left: "30px",
      })
      .click(() => this.runPrev())
      .prop("disabled", true)
      .appendTo(this.div)

    this.btnNext = $("<button>")
      .addClass("btn")
      .text(">>")
      .css({
        position: "absolute",
        top: "30px",
        right: "30px",
      })
      .click(() => this.runNext())
      .prop("disabled", true)
      .appendTo(this.div)

    this.prompt = $("<div>")
      .css({
        "max-width": this.promptWidth,
        "min-height": this.promptHeight,
        margin: "auto",
        "margin-bottom": 50,
      })
      .appendTo(this.div)

    this.content = $("<div>").appendTo(this.div).css({
      float: "left",
      width: this.contentWidth,
      // border: '1px solid red',
    })

    this.stage = 0
    this.maxStage = 0
    this.stages = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter((f) => f.startsWith("stage_"))
      .map((f) => this[f])

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
    await this.runStage(stage ?? 1)
    await this.completed
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

  async button(text = "continue", opts = {}) {
    _.defaults(opts, { delay: 0 })
    let btn = button(this.prompt, text, opts)
    await btn.clicked
    btn.remove()
  }

  instruct(md) {
    let prog = this.stage ? `(${this.stage}/${this.stages.length})` : ""
    this.message(`# Instructions ${prog}\n\n` + md)
  }

  async runStage(n) {
    this.rejectPromises()
    this._sleep?.reject()
    this.prompt.empty()
    this.content.empty()
    this.content.css({ opacity: 1 }) // just to be safe
    logEvent(`instructions.runStage.${n}`)
    this.maxStage = Math.max(this.maxStage, n)
    this.stage = n
    this.btnNext.prop("disabled", this.stage >= this.maxStage)
    this.btnPrev.prop("disabled", this.stage <= 1)
    await this.stages[n - 1].bind(this)()
    if (this.stage == n) {
      // check to make sure we didn't already move forward
      this.enableNext()
    }
  }

  runNext() {
    saveData()
    logEvent("instructions.runNext")
    this.btnNext.removeClass("btn-pulse")
    if (this.stage == this.stages.length) {
      logEvent("instructions.completed")
      psiturk.finishInstructions()
      this.completed.resolve()
      this.div.remove()
    } else {
      this.runStage(this.stage + 1)
    }
  }

  async runPrev() {
    logEvent("instructions.runPrev")
    await this.runStage(this.stage - 1)
  }

  enableNext() {
    this.btnNext.addClass("btn-pulse")
    this.maxStage = Math.max(this.maxStage, this.stage + 1)
    this.btnNext.prop("disabled", false)
  }
}

function parseQuizText(text) {
  const lines = text.trim().split("\n")
  const questions = []
  let currentQuestion = null

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (trimmedLine.startsWith("#")) {
      if (currentQuestion) {
        questions.push(currentQuestion)
      }
      currentQuestion = [trimmedLine.slice(1).trim(), [], null]
    } else if (trimmedLine.startsWith("-") || trimmedLine.startsWith("*")) {
      const option = trimmedLine.slice(1).trim()
      currentQuestion[1].push(option)
      if (trimmedLine.startsWith("*")) {
        currentQuestion[2] = option
      }
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion)
  }

  return questions
}

class Quiz {
  constructor(questions) {
    if (typeof questions == "string") {
      questions = parseQuizText(questions)
    }
    this.questions = questions
    this.div = $("<div>")
    this.done = make_promise()
    this.correct = []
    this.inputs = questions.map((q) => {
      this.correct.push(q[2])
      return radio_buttons(this.div, q[0], q[1])
    })
    this.button = $("<button>", { class: "btn btn-primary" })
      .text("check answers")
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
    let answers = this.inputs.map((i) => i.val())
    logEvent("quiz.check", { answers, correct: this.correct })
    let pass = _.every(_.zip(answers, this.correct), ([a, c]) => {
      return a == c
    })
    console.log("pass", pass)
    if (pass) {
      alert_success()
      this.done.resolve()
    } else {
      alert_failure({
        title: "Try again",
        html: "Click the arrows at the top of the screen to review the instructions if needed.",
      })
    }
  }
}

class MachineInstructions extends Instructions {
  constructor(params) {
    super({ contentWidth: 1200 })
    this.params = _.cloneDeep(params)
    let blockString = (this.blockString = `
      11___22
      _11222_
      __112__
      _11222_
      11___22
    `)
    this.blockString2 = `
      1_____2
      1_122_2
      1111222
      1_122_2
      1_____2
    `

    this.manual = [
      { code: "1234", compositional: false, blockString },
      { code: "1235", compositional: false, blockString },
      { code: "3124", compositional: true, blockString },
    ]
    window.instruct = this
  }

  getPuzzle(idx, opts = {}) {
    let code = this.manual[idx].code
    let type = this.manual[idx].compositional ? "compositional" : "bespoke"
    let solutions = {[code]: type}

    let mp = new MachinePuzzle({
      ...this.params,
      solutions,
      blockString: this.blockString,
      machineColor: "#ffe852",
      ...opts,
    })
    mp.attach(this.content)
    return mp
  }

  async stage_welcome() {
    let mp = this.getPuzzle(0)
    mp.manualDiv.hide()
    mp.solutions = {}

    this.instruct(`
      Welcome! In this experiment, you will be building shapes using
      the machine below. (Click the pulsing arrow to continue).
    `)
  }

  async stage_intro() {
    let mp = this.getPuzzle(0)
    mp.manualDiv.hide()
    mp.drawTarget()
    this.instruct(`
      On each round, a shape will appear on the screen. 
      Your job is to find a code that produces this shape. 
      You can click and drag the dials to change the code. 
      As soon as you land on the right code, the shape will be built. 
      Try entering the code 1234.
    `)
    await mp.done
    // this.prompt.append('<b>Nice!</b>');
  }

  async stage_multiple() {
    let mp = this.getPuzzle(1)
    mp.manualDiv.hide()
    mp.drawTarget()
    this.instruct(`
      Each shape can be built using multiple codes. 
      Try to find another code that builds this shape.
      (We disabled 1234).

      <div class="alert alert-info" role="alert">
        <i class="bi bi-info-circle-fill me-2"></i>
        <strong>Tip:</strong>
        You can quickly go through possible codes by clicking on one of the dials.
        It will automatically increment the next dial when you cycle back to 1.
      </div>
    `)
    await mp.done
    // this.prompt.append('<b>Nice!</b>');
  }

  async stage_compositional() {
    let mp = this.getPuzzle(2)
    mp.manualDiv.hide()
    mp.drawTarget()
    this.instruct(`
      Try to find one more code. Hint: this one ends with 24.

      <div class="alert alert-info" role="alert">
        <i class="bi bi-info-circle-fill me-2"></i>
        <strong>Tip:</strong> 
        Start by setting the last two digits to 24. Then repeatedly click on the second
        dial to go through possible codes that end with 24.
      </div>
    `)
    await mp.done
    // this.prompt.append('<b>Nice!</b>');
  }

  async stage_manual() {
    let mp = this.getPuzzle(2, { manual: this.manual })
    mp.drawTarget()
    mp.dialsDisabled = true

    this.instruct(`
      To help you remember what you've learned about the machine, we'll keep an updated manual for you.
      Every time you discover a new code, we'll add it to the manual.
    `)
  }

  async stage_only_target() {
    let mp = this.getPuzzle(0, {
      manual: this.manual,
      blockString: this.blockString2,
      solutions: { "0000": null },
    })
    mp.drawTarget()

    this.instruct(`
      One last thing. The machine will only ever produce the shape on the screen.
      If you enter a code for a different shape, nothing will happen.
      Try entering 1234 into the machine to see what happens.
    `)
    await this.eventPromise(
      (event) => event.event.startsWith("machine.enter") && event.code == "1234"
    )
    this.instruct("See? Nothing happened.")
    mp.dialsDisabled = true
  }


  async stage_new_machine() {
    let mp = this.getPuzzle(0, {
      machineColor: "#656565",
      solutions: {"0000": null}
    })

    this.instruct(`
      For the rest of the experiment, you'll be working on this new machine.
      It operates in the same way as the yellow practice machine, 
      but it makes different shapes and uses different codes. 
    `)
    mp.manualDiv.hide()
  }

  async stage_quiz() {
    this.instruct(`
      Before moving on, let's make sure you understand how the machine works.
      If you're not sure, you can navigate to the earlier screens with the 
      buttons on the sides of the screen.
    `)

    this.quiz =
      this.quiz ??
      new Quiz(`
        # There is only one code to make each shape.
          - true
          * false
        # What is the easiest way to find the code for a shape?
        * Check the manual
          - Guess randomly
        # If you still have no idea after checking the manual, what should you do?
          * Systematically try codes by repeatedly clicking on one of the dials
          - Guess random codes by sliding the dials up and down
        # If you enter the code for a different shape, what will happen?
          - The machine will break and you'll have to start over
          - The machine will add the shape and add code to the manual
          * Nothing will happen
        # The codes you learned on the practice machine will work later in the experiment.
          - true
          * false
      `)
    await this.quiz.run($("<div>").appendTo(this.prompt))
    this.runNext()
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
    let question =
      "Are you going to refresh the page after completing the instructions?"
    let radio = radio_buttons(this.prompt, question, ["yes", "no"])
    let post = $("<div>").appendTo(this.prompt)
    let no = make_promise()
    let done = false
    radio.click((val) => {
      if (val == "yes") {
        post.html("Haha... But seriously.")
      } else {
        no.resolve()
      }
    })
    await no
    radio.buttons().off()
    radio.buttons().prop("disabled", true)
    post.html("Good. No refreshing!")
    await this.button("finish instructions")
    this.runNext() // don't make them click the arrow
  }
}
