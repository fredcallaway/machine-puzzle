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

    this.helpText = `
      Sorry, you're on your own! If you're really stuck, send us a message on Prolific.
    `

    this.btnHelp = $("<button>")
      .appendTo(this.div)
      .css({
        position: "absolute",
        right: "-50px",
        top: "10px",
      })
      .addClass("btn-help")
      .text("?")
      .hide()
      .click(async () => {
        await Swal.fire({
          title: "Help",
          html: this.helpText,
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
      // .appendTo(this.div)

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
      // .appendTo(this.div)

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

  showHelp(text) {
    logEvent("instructions.showHelp", {stage: this.stageName()})
    this.helpText = text
    this.btnHelp.show()
    this.btnHelp.addClass("btn-pulse")   
    this.btnHelp.click(() => {
      logEvent("instructions.viewHelp", {stage: this.stageName(), text})
      this.btnHelp.removeClass("btn-pulse")
    })
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
  
  async helpPromise(text, delay) {
    await this.sleep(delay)
    this.showHelp(text)
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

  async runStage(n) {
    this.rejectPromises()
    this.cancelEventCallbacks()
    this._sleep?.reject()
    this.prompt.empty()
    this.btnHelp.hide()
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
      this.runNext()
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

class MachineInstructions extends Instructions {
  constructor({params, shapes, codes, mainParams}) {
    super({ contentWidth: 1200, promptHeight: 200 })
    this.params = _.cloneDeep(params)
    this.shapes = shapes
    this.codes = codes
    this.mainParams = mainParams
    window.instruct = this
  }

  stageName(stage) {
    stage = stage ?? this.stage
    return this.stages[stage].name.replace("stage_", "instruct.")
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
      trialID: this.stageName(),
      task,
      solutions,
      blockString,
      ...opts,
    })
    mp.attach(this.content)
    return mp
  }

  buildManual(pairs) {
    return pairs.map(([task, type]) => this.manualEntry(task, type))
  }

  manualEntry(task, type) {
    return {
      task, blockString: this.shapes[task], compositional: type == "compositional", code: this.codes[task][type]
    }
  }

  async centerMessage(md) {
    this.prompt.hide()
    await text_continue(this.content, markdown(md)).promise()
    this.prompt.show()
  }

  async stage_intro() {
    await this.centerMessage(`
      Welcome! In this experiment, you will crack codes to make different shapes.
    `)
    
    await this.centerMessage(`
      Unlike other studies you may have done, we will not be providing any instructions.
    `)

    await this.centerMessage(`
      You will have to figure out how to progress through the study on your own.
    `)

    await this.centerMessage(`
      Good luck. You'll need it!
      
      *ominous laughter*
    `)
  } 

  async stage_bespoke() {  
    let mp = this.getPuzzle("11", {
      solutionType: "bespoke",
      manual: this.buildManual([
        ["11", "bespoke"]
      ]),
    })
    mp.buttonDiv.hide()
    this.helpPromise("Click on the dials to create the shape using the code in the manual.", 30000)
    await mp.done
  }

  async stage_compositional() {
    let mp = this.getPuzzle("22", {
      solutionType: "compositional",
      manual: this.buildManual([
        ["12", "compositional"],
        ["21", "compositional"],
      ]),
    })
    mp.buttonDiv.hide()
    this.helpPromise("You need to combine the two codes in the manual to make the target shape.", 120000)
    await mp.done
  }

  disableDials(mp) {
    $('.dial').css('pointer-events', 'none')
    mp.dialContainer.on('click', (e) => {
      logEvent("instruct.hint.blockdials")
      alert_failure({
        title: "Sorry",
        html: "<em>The dials are disabled on this round of the instructions</em>",
      })
    })
  }
  
  async stage_bespoke_button() {
    let mp = this.getPuzzle("33", {
      solutionType: "bespoke",
      manual: this.buildManual([
      ])
    })
    this.helpPromise("Keep clicking the purple button until something happens.", 60000)

    $('.code-btn-left').css('visibility', 'hidden')
    $('.code-btn-right').css('visibility', 'hidden')
    this.disableDials(mp)
    await mp.done

    await this.centerMessage(`
      That was really annoying wasn't it? If you think carefully, you won't need to do that very often.
    `)
  }
  
  async stage_compositional_buttons() {
    let mp = this.getPuzzle("44", {
      solutionType: "compositional",
      manual: this.buildManual([
      ])
    })
    this.helpPromise("Keep clicking the red and blue buttons until something happens.", 60000)
    $('.code-btn-bespoke').hide()
    // $('.code-btn-right').hide()
    this.disableDials(mp)
    await mp.done
  }

  // async stage_new_machine() {
  //   await this.centerMessage(`
      
  //   `)

  //   let mp = new MachinePuzzle({
  //     ...this.mainParams,
  //   }).attach(this.content)
  //   mp.drawTarget("blank")
  //   mp.lockInput()

  

  //   this.message(`
  //     For the rest of the study, you'll be working on this new machine.
  //     It operates in the same way as the yellow machine, 
  //     but its codes are much harder to crack!
  //     To start you off, we've filled in your manual with some codes used by previous operators of this machine.
  //   `)
  //   await this.button()
  //   this.runNext()
  // }

  async stage_final() {
    await this.centerMessage(`
      You've finished the practice rounds and are ready to move onto the main phase of the experiment.
      There will be ${config.trials.length} rounds.
      Try to complete them all as quickly as possible.

      <br>

      <div class="alert alert-danger" style="text-align: left;">
        <b>Warning!</b><br>
        Once you continue past this screen, <strong>you cannot refresh the page</strong>.
        If you do, you will get an error message and you won't be able to complete the study.
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
