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

  restartStage() {
    this.runStage(this.stage)
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

  async check() {
    let answers = this.inputs.map((i) => i.val())
    logEvent("quiz.check", { answers, correct: this.correct })
    let pass = _.every(_.zip(answers, this.correct), ([a, c]) => {
      return a == c
    })
    if (pass) {
      await alert_success()
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
  constructor({params, shapes, codes, mainParams}) {
    super({ contentWidth: 1200, promptHeight: 200 })
    this.params = _.cloneDeep(params)
    this.shapes = shapes
    this.codes = codes
    this.mainParams = mainParams
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
      maxDigit: 6,
      nClickBespoke: 10,
      nClickPartial: 7,
      buttonDelay: 300,
      machineColor: "#ffe852",
      suppressSuccess: true,
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

  async stage_intro() {
    let mp = this.getPuzzle("11", {
      solutionType: "bespoke",
      manual: this.buildManual([
        ["11", "bespoke"]
      ]),
    })
    mp.drawTarget("blank")
    mp.buttonDiv.hide()
    mp.manualDiv.hide()
    mp.lockInput()

    this.instruct(`
      Welcome! In this experiment, you will be cracking codes using the machine below.
    `)
    await this.button()
    
    mp.drawTarget()
    this.instruct(`
      On each round, a shape will appear on the screen. 
      Your job is to find a code that creates this shape.
    `)
    await this.button()
    
    mp.manualDiv.show()
    this.instruct(`
      To make things easier, you'll have a manual that provides codes
      for some of the shapes you might have to build.
    `)
    await this.button()  

    mp.unlockInput()
    this.instruct(`
      Give it a try! Click on a dial to change its number.
      As soon as you land on the right code, the shape will be created. 
    `)
    await mp.done
    this.instruct(`
      Well done!
    `)
    await this.button()
    this.runNext()
    // this.prompt.append('<b>Nice!</b>');
  }

  async stage_compositional() {
    let mp = this.getPuzzle("11", {
      solutionType: "compositional",
      manual: this.buildManual([
        ["11", "bespoke"],
        ["11", "compositional"],
      ])
    })
    mp.buttonDiv.hide()

    this.instruct(`
      Each shape can be created by multiple codes. 
      Try entering the new code from the manual
      (we disabled ${this.codes["11"].bespoke}).
    `)

    this.registerEventCallback((event) => {
      console.log('callback', event)
      if (event.event.startsWith("machine.enter") && event.code == this.codes["11"].bespoke) {
        alert_info({html: `We disabled ${this.codes["11"].bespoke}. Try the other code from the manual!`})
      }
    })

    await this.eventPromise("machine.animationDone")
    this.instruct(`
      Some codes build the shape in two parts. Complete the code
      to build the other half!
    `)
    await mp.done
    this.instruct("Perfect!")
    await this.button()
    this.runNext()
  }
  
  async stage_full() {
    let mp = this.getPuzzle("12", {
      trialID: "instruct.compositional",
      solutionType: "compositional",
      manual: this.buildManual([
        ["11", "bespoke"],
        ["11", "compositional"],
        ["22", "compositional"],
      ]),
    })
    mp.buttonDiv.hide()
    this.instruct(`
      Here's a new shape. Try to crack its code using the manual.

      _Hint: you might need to combine multiple codes!_
    `)

    let color1 = (txt) => `<span style="font-weight: bold; color: ${COLORS[1]};">${txt}</span>`
    let color2 = (txt) => `<span style="font-weight: bold; color: ${COLORS[2]};">${txt}</span>`
    let color12 = (txt) => color1(txt.slice(0, 2)) + color2(txt.slice(2))

    this.registerEventCallback((event) => {
      if (event.event.startsWith("machine.enter")) {
        if (event.code == this.codes["12"].compositional) {
          return
        }
        let msg = {
          5: `Focus on the shapes in the manual that are built from two pieces.`,
          10: `Notice that the target shape has an O shape and a fork shape.`,
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
      Well done! You can sometimes crack new codes
      by combining two different codes from the manual.
    `)
    await this.button()
    this.instruct(`
      But take note! Only the blue and red codes can be combined.
      The purple codes are unique and only make one shape.
      `)
      await this.button()
      this.runNext()
  }

  async stage_forever() {
    let mp = this.getPuzzle("33", {
      nClickBespoke: 5,
      manual: this.buildManual([
        ["11", "bespoke"],
        ["11", "compositional"],
        ["22", "compositional"],
        ["12", "compositional"],
      ])
    })
    mp.buttonDiv.hide()
    this.instruct(`
      Sometimes the manual won't have a code for the shape you're trying to crack.
      In this case, you'll have to figure it out yourself. Give it a shot!
    `)

    await this.eventPromise(
      (event) => event.event.startsWith("machine.enter") && mp.nTry >= 3
    )

    await alert_info({
      title: "This is gonna take forever!",
      html: "<em>Let's try a different approach...</em>",
      confirmButtonText: 'OK',
    })
    this.runNext()
  }

  async stage_bespoke_button() {
    let mp = this.getPuzzle("33", {
      nClickBespoke: 5,
      solutionType: "bespoke",
      manual: this.buildManual([
        ["11", "bespoke"],
        ["11", "compositional"],
        ["22", "compositional"],
        ["12", "compositional"],
      ])
    })

    $('.code-btn-left').hide()
    $('.code-btn-right').hide()
    
    this.instruct(`
      To make cracking codes easier, the machine has a _Smart Button_&trade; that automatically
      searches for a valid code. Using the smart button is much faster than guessing randomly,
      but it can still take a few tries. Give it a shot!
    `)
    
    $('.dial').css('pointer-events', 'none')
    mp.dialContainer.on('click', (e) => {
      logEvent("instruct.hint.blockdials")
      alert_failure({
        title: "Try using the Smart Button!",
        html: "<em>The dials are disabled on this round of the instructions</em>",
      })
    })
    await mp.done
    this.instruct(`You got it! Note that the purple Smart Button will usually find purple codes.`)
    await this.button()
    this.runNext()
  }

  async stage_comp_buttons() {
    let mp = this.getPuzzle("33", {
      solutionType: "compositional",
      manual: this.buildManual([
        ["11", "bespoke"],
        ["11", "compositional"],
        ["22", "compositional"],
        ["12", "compositional"],
        ["33", "bespoke"],
      ])
    })
    $('')
    $('.code-btn-bespoke').addClass('disabled')
    
    this.instruct(`
      There are two additional Smart Buttons on the machine. These ones will only
      search for one part of the code at a time. Try them out!
    `)

    $('.dial').css('pointer-events', 'none')
    mp.dialContainer.on('click', (e) => {
      logEvent("instruct.hint.blockdials")
      alert_failure({
        title: "Try using the Smart Buttons!",
        html: "<em>The dials are disabled on this round of the instructions</em>",
      })
    })
    
    await this.eventPromise("machine.solution")
    this.prompt.append("You solved half of the code! Now use the other Smart Button to finish it.")
    await mp.done
    this.instruct(`
      That's it! The red and blue Smart Buttons will usually find red and blue codes.
      However, this usually takes longer than searching for a purple code.
    `)
    await this.button()
    this.runNext()
  }

  async stage_partial() {
    let mp = this.getPuzzle("42", {
      maxTryPartial: 5,
      manual: this.buildManual([
        ["11", "bespoke"],
        ["11", "compositional"],
        ["22", "compositional"],
        ["12", "compositional"],
        ["33", "bespoke"],
        ["33", "compositional"],
      ]),
      solutionType: "compositional",
    })
    mp.lockInput()
    this.instruct(`
      Sometimes the manual will only include half of the code for the
      shape you're trying to crack.
    `)
    await this.button()
    this.instruct(`
      In this case, you can start by entering the part of the code you already know...
    `)
    mp.unlockInput()
    
    mp.altNextCode = () => {
      logEvent("instruct.hint.trymanual")
      alert_info({
        html: `Try using the manual first!`,
      })
    }
    
    this.registerEventCallback((event) => {
      if (
        event.event.startsWith("machine.enter") &&
        mp.nTry > 0 &&
        mp.nTry % 5 == 0
      ) {
        if (!mp.partialSolution) {
          logEvent(`instruct.hint.partial.${mp.nTry}`)
          saveData()
          alert_info({
            html: `Focus on the red parts of the shapes in the manual.`,
          })
        }
      }
    })
    
    let solution = await this.eventPromise("machine.solution")
    if (solution.event.endsWith('right')) {
      // this is the intended path
      logEvent('instruct.partial.right_first')
      this.instruct("That's it!")
      await this.eventPromise("machine.animationDone")
      this.instruct(`
        Now you can use the blue Smart Button to search for the rest of the code.
      `)
      mp.altNextCode = null
      await mp.done
      this.instruct(`
        Alright!
      `)
      await this.button()
      this.runNext()
    } else {
      // participant accidentally found the left half, try again
      logEvent('instruct.partial.left_first')
      mp.div.remove()
      await alert_failure({
        title: "Something went wrong!",
        html: `
          Let's try this round again. Make sure to follow
          the instructions closely! You should start by
          entering the right half of the code (which you 
          know from the manual).
        `
      })
      this.restartStage()
      throw new Error("restart stage")  
    }
  }

  async stage_only_target() {
    this.instruct(`
      One last note.
      _You can only create the shape currently on the screen._
      If you enter a code for a different shape, nothing will happen.
      
      See the example below and click continue when you're ready—_no need to click anything!_
    `)

    let mp = this.getPuzzle("33", {
      showManual: true,
      manual: this.buildManual([
        ["11", "compositional"],
      ]),
      initialCode: this.codes["11"].compositional
    })
    this.registerEventCallback((event) => {
      if (event.event.startsWith("machine.enter") && mp.nTry == 10) {
        alert_info({
          title: 'FYI',
          html: `You can move on from this screen whenever you'e ready!`,
        })
      }
    })
    await this.button()
    this.runNext()
  }

  async stage_new_machine() {
    let mp = new MachinePuzzle({
      ...this.mainParams,
    }).attach(this.content)
    mp.drawTarget("blank")
    mp.lockInput()

    this.instruct(`
      For the rest of the study, you'll be working on this new machine.
      It operates in the same way as the yellow machine, 
      but its codes are much harder to crack!
      To start you off, we've filled in your manual with some codes used by previous operators of this machine.
    `)
    await this.button()
    this.runNext()
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
        # What do the Smart Buttons do?
          - They reveal a valid code, letting you give up on the round
          * They search for a valid code
        # If you enter the code for a different shape, what will happen?
          * Nothing will happen
          - The machine will break and you'll have to start over
          - The machine will add the code to the manual
      `)
    await this.quiz.run($("<div>").appendTo(this.prompt))
    this.runNext()
  }

  async stage_final() {
    this.instruct(`
      You've finished the instructions, and are ready to move onto the main phase of the experiment.

      There will be ${config.trials.length} rounds.
      Try to complete them all as quickly as possible, using the manual as much as you can.

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
