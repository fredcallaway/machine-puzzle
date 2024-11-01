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
    this.eventCallbacks = []
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

  registerEventCallback(callback) {
    this.eventCallbacks.push(callback)
    registerEventCallback(callback)
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

  cancelEventCallbacks() {
    for (const callback of this.eventCallbacks) {
      removeEventCallback(callback)
    }
    this.eventCallbacks = []
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
    this.cancelEventCallbacks()
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
    // Ensure all questions have a correct answer
    this.questions.forEach(q => {
      if (!q[2]) {
        throw new Error("Quiz question has no correct answer: " + q[0])
      }
    });
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
  constructor({params, shapes, codes}) {
    super({ contentWidth: 1200, promptHeight: 200 })
    this.params = _.cloneDeep(params)
    this.shapes = shapes
    this.codes = codes
    window.instruct = this
  }
    // Define the codes used in the instructions

  getPuzzle(task, opts = {}) {
    assert(this.shapes[task], `unknown task: ${task}`)
    let solutions = opts.solutionType
      ? { [this.codes[task][opts.solutionType]]: opts.solutionType }
      : {}
    let blockString = this.shapes[task]
    console.log(blockString, solutions)
    let mp = new MachinePuzzle({
      ...this.params,
      trialID: this.stages[this.stage].name.replace("stage_", "instruct."),
      task,
      solutions,
      blockString,
      maxDigit: 4,
      machineColor: "#ffe852",
      suppressSuccess: true,
      showLocks: false,
      showNextCodeButton: false,
      ...opts,
    })
    mp.attach(this.content)
    return mp
  }

  buildManual(pairs) {
    return pairs.map(([task, type]) => ({
      task, blockString: this.shapes[task], compositional: type == "compositional", code: this.codes[task][type]
    }))
  }

  async stage_welcome() {
    let mp = this.getPuzzle("11", {
      trialID: "instruct.welcome",
    })
    mp.drawTarget("blank")

    this.instruct(`
      Welcome! In this experiment, you will be cracking codes using the machine below.
      
      _Click the pulsing arrow on the right to continue._
    `)
  }

  async stage_intro() {
    let mp = this.getPuzzle("11", {
      solutionType: "bespoke",
    })
    this.instruct(`
      On each round, a shape will appear on the screen. 
      Your job is to find a code that creates this shape. 
      Click on a dial to change its number.
      As soon as you land on the right code, the shape will be created. 
      _Try entering the code ${this.codes["11"].bespoke}._
    `)
    await mp.done
    // this.prompt.append('<b>Nice!</b>');
  }

  async stage_compositional() {
    let mp = this.getPuzzle("11", {
      solutionType: "compositional",
    })
    this.instruct(`
      Each shape can be created by multiple codes. 
      Try entering ${this.codes["11"].compositional} this time.
    `)
    await this.eventPromise("machine.animationDone")
    this.instruct(`
      Huh! It looks like you found part of the code for this shape,
      but we're still missing the other half. Complete the shape
      by entering the rest of the code (${this.codes["11"].compositional}).
    `)
    await mp.done
  }

  async stage_trynext() {
    let mp = this.getPuzzle("33", {
      showNextCodeButton: true,
      maxTry: 20,
    })
    mp.dialsDisabled = true
    this.instruct(`
      Here's a new shape. Try to crack its code.
    `)

    await this.eventPromise(
      (event) => event.event.startsWith("machine.enter") && mp.nTry >= 5
    )
    await alert_info({
      title: "This is gonna take forever!",
      html: "<em>Let's try a different approach!</em>",
    })

    mp.solutions = { [this.codes["33"].bespoke]: "bespoke" }
    this.instruct(`
      To make cracking codes easier, we've added a new green button next to the dial. 
      When you click it, the machine will automatically try a code you haven't tried yet.

      If you don't know what the code is, just click this button repeatedly until you find the right one.
      Give it a try!
    `)

    $('.dial-select').css('pointer-events', 'none').css('opacity', 1)
    $(".dial").on('click', (e) => {
      logEvent("instruct.hint.trygreen")
      alert_failure({
        title: "Try the green button!",
        html: "<em>The dials are disabled on this round of the instructions</em>",
      })
    })

    await mp.done

    this.instruct(`
      Huh! That code seemed to make the shape out of two pieces. Neat!
    `)
  }

  async stage_full() {
    let mp = this.getPuzzle({
      trialID: "instruct.compositional",
      showManual: true,
      showNextCodeButton: true,
      solutions: { [this.codes.comp12]: "compositional" },
      maxTry: 1000,
    })
    this.instruct(`
      Here's a new shape. Try to crack its code.
      
      _Hint: You can use the manual to help you!_
    `)
    mp.nextCodeButton.off('click')
    mp.nextCodeButton.on('click', () => {
      logEvent("instruct.hint.trymanual")
      alert_info({
        html: `Try using the manual on this round.`,
      })
    })

    let color1 = (txt) => `<span style="font-weight: bold; color: ${COLORS[1]};">${txt}</span>`
    let color2 = (txt) => `<span style="font-weight: bold; color: ${COLORS[2]};">${txt}</span>`
    let color12 = (txt) => color1(txt.slice(0, 2)) + color2(txt.slice(2))

    this.registerEventCallback((event) => {
      if (event.event.startsWith("machine.enter")) {
        let msg = {
          5: `Look at the shapes in the manual that are built from two pieces.`,
          10: `Notice how two pieces have codes that start with ${color1(this.codes.left1)}`,
          15: `Does that red T shape at the end of the manual look familiar?`,
          20: `This shape is a combination of two shapes in the manual, with codes 
              ${color1(this.codes.left1) + this.codes.right1} and 
              ${this.codes.left3 + color2(this.codes.right2)}`,
        }[mp.nTry]
        // maybe "crash" the experiment if they take too long
        if (msg) {
          logEvent(`instruct.hint.compositional.${mp.nTry}`)
          saveData()
          alert_info({
            html: msg
          })
        }
      }
    })
    await mp.done
    this.instruct(`
      Well done! You've discovered that you can sometimes crack codes by combining the codes
      for other shapes.
    `)
  }

  async stage_locks() {
    let mp = this.getPuzzle({
      trialID: "instruct.locks",
      showManual: true,
      showNextCodeButton: true,
      showLocks: true,
      maxTryPartial: 10,
      manual: [
        ...this.manual,
        {task: 'null', blockString: this.shape12, compositional: true, code: this.codes.comp12},
      ],
      solutions: { [this.codes.comp21]: "compositional" },
    })
    this.instruct(`
      Sometimes you'll only know part of the code for a shape from the manual.
      In this case, you can lock the dials you already know.
      Then you can use the green button to crack the rest of the code without messing
      up the part you already entered. _Try cracking the code with this strategy._
    `)
    this.registerEventCallback((event) => {
      if (
        event.event.startsWith("machine.enter") &&
        mp.nTry > 0 &&
        mp.nTry % 5 == 0
      ) {
        let correctEnd = mp.currentCode.join("").endsWith(this.codes.right1)
        let locked = mp.dialLocked[2] && mp.dialLocked[3]
        if (!correctEnd || !locked) {
          logEvent(`instruct.hint.locks.${mp.nTry}`)
          saveData()
          alert_info({
            html: `Look at the shape with code ${this.codes.comp11} in the manual. Focus on the red part. Make sure to lock the dials you already know!`,
          })
        }
      }
    })
    await mp.done
  }

  async stage_only_target() {
    this.instruct(`
      One last note.
      _You can only create the shape currently on the screen._
      If you enter a code for a different shape, nothing will happen.
      
      See the example below and continue when you're ready—_no need to click anything!_
    `)

    let mp = this.getPuzzle({
      blockString: this.shape21,
      showManual: true,
      manual: [
        {task: 'null', blockString: this.shape11, compositional: true, code: this.codes.comp11}
      ],
      showNextCodeButton: true,
      showLocks: true,
      solutions: { "0000": null },
      initialCode: this.codes.comp11
    })
    this.registerEventCallback((event) => {
      if (event.event.startsWith("machine.enter") && mp.nTry == 10) {
        alert_info({
          title: 'FYI',
          html: `You can move on from this screen whenever you'e ready!`,
        })
      }
    })
  }

  async stage_new_machine() {
    let mp = this.getPuzzle({
      machineColor: "#656565",
      solutions: { "0000": null },
      ...this.params,
      showNextCodeButton: true,
      showLocks: true,
    })
    mp.drawTarget("blank")

    this.instruct(`
      For the rest of the experiment, you'll be working on this new machine.
      It operates in the same way as the yellow practice machine, 
      but it has more possible codes and makes more shapes.
    `)
  }

  async stage_quiz() {
    this.instruct(`
      Before moving on, let's make sure you understand how the machine works.
      If you're not sure, you can navigate to the earlier screens with the 
      buttons on the sides of the screen.
    `)

    this.quiz =
      this.quiz ??
      // prettier-ignore
      new Quiz(`
        # There is only one code to make each shape.
          - True
          * False
        # You can only use the manual if it has the exact shape you're trying to crack.
          - True
          * False
        # What does the green button do?
          - It creates the shape
          * It tries the next possible code
          - It locks the dials that are in the correct position
        # What do the locks do?
          - They show you which dials are in the correct position
          * They prevent the green button from changing some positions of the code
        # If you enter the code for a different shape, what will happen?
          * Nothing will happen
          - The machine will break and you'll have to start over
          - The machine will update the manual
        # The codes you learned on the practice machine will work later in the experiment.
          - True
          * False
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
