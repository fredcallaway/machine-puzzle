const PROLIFIC_CODE = 'CH2Q1VIL'
const PARAMS = {
  config_dir: "code-pilot",
  width: 7,
  height: 5,
  nClickBespoke: 35,
  nClickPartial: 25,
  solutionDelay: 6000,
  buttonDelay: 500,
  maxTotalTries: 400,
  maxTries: 100,
}


const INSTRUCT_PARAMS = {
  maxDigit: 9,
  maxTries: 50,
  // width: 6,
  // height: 5,
  buttonDelay: PARAMS.buttonDelay,
  solutionDelay: PARAMS.solutionDelay * (5 / 7), // height difference
  nClickBespoke: PARAMS.nClickBespoke,
  nClickPartial: PARAMS.nClickPartial,
  // machineColor: "#ffe852",
}

ERROR_EMAIL = 'fredcallaway@gmail.com'

async function runExperiment() {
  if (urlParams.draw) {
    _.extend(PARAMS, urlParams)
    console.log("👉", _.pick(PARAMS, ['width', 'height', 'blockSize', 'numScreens']))
    new DrawingInterface(_.pick(PARAMS, ['width', 'height', 'blockSize', 'numScreens', 'storageKey'])).attach(DISPLAY)
    await make_promise()
  }
  let configFile = urlParams.test ? 
    'static/json/test.json' :
    `static/json/${PARAMS.config_dir}/${CONDITION}.json`
  try {
    config = await $.getJSON(configFile)
    console.log(configFile, config)
  } catch(err) {
    console.log("ERR HERE")
    throw new Error(`${configFile} does not exist`)
  }
  window.config = config // note I actually use this in instructions.js (HACK) but don't remove it!

  _.extend(PARAMS, config.params)
  _.extend(PARAMS, urlParams)
  psiturk.recordUnstructuredData('params', PARAMS);

  logEvent('experiment.initialize', {CONDITION, PARAMS})
  enforceScreenSize(1250, 750)

  if (PARAMS.maxTotalTries < 2 * PARAMS.nClickPartial * config.trials.length) {
    throw new Error("maxTotalTries is too low!")
  }

  _.extend(config.instructions.params, INSTRUCT_PARAMS)

  async function instructions() {
    logEvent('experiment.instructions')
  await new MachineInstructions(config.instructions).run(DISPLAY)
  }

  async function main() {
    logEvent('experiment.main')
    DISPLAY.empty()

    let top = new TopBar({
      nTrial: config.trials.length,
      height: 70,
      width: 1150,
      helpTitle: 'Feeling stuck?',
    }).prependTo(DISPLAY)

    let totalTries = 0

    registerEventCallback(async (info) => {
      if (info.event == "machine.enter") {
        totalTries += 1
        if (totalTries == PARAMS.maxTotalTries) {
          terminateExperiment("maxTotalTries", {totalTries})
        }
      }
    })

    let workspace = $('<div>').appendTo(DISPLAY)
    if (urlParams.main) {
      const n = parseInt(urlParams.main) - 1
      for (let i = 0; i < n; i++) {
        top.incrementCounter()
      }
      config.trials = config.trials.slice(n)
    }
    for (let trial of config.trials) {
      await new MachinePuzzle({...PARAMS, ...trial}).run(workspace)
      top.incrementCounter()
      saveData()
    }
  }

  async function survey() {
    logEvent('experiment.instructionsSurvey')
    DISPLAY.empty()
    let div = $('<div>').appendTo(DISPLAY).addClass('text')

    $('<p>').appendTo(div).html(markdown(`
      # Feedback survey

      We'd like to ask you a few questions about the instructions.
    `))

    const feedback = {
      annoying: radio_buttons(div, `
        Was it more annoying/frustrating or fun/engaging to figure out what to do by yourself?
      `, ['very annoying', 'more annoying', 'neutral', 'more fun', 'very fun']),

      hints: radio_buttons(div, `
        If you got hints, did they come at an appropriate time?
      `, ['too early', 'about right', 'too late', "I didn\'t get any hints"]),

      feedback: text_box(div, `
        Was there any specific part where you wish we had given more information?
      `),

      summary: text_box(div, `
        Briefly summarize what you learned in the practice rounds.
      `)
    }
    await button(div, 'submit').clicked
    logEvent('instructionsSurvey.submitted', _.mapValues(feedback, x => x.val()))
  }

  async function debrief() {
    logEvent('experiment.debrief')
    DISPLAY.empty()
    let div = $('<div>').appendTo(DISPLAY).addClass('text')


    $('<p>').appendTo(div).html(markdown(`
      # You're done!

      Thanks for participating! We have a few quick questions before you go.
      Please answer all the questions, but feel free to be brief.
    `))

    const feedback = {
      manual: text_box(div, `
        When did you use the smart buttons vs. the manual? Why?
      `),

      preference: text_box(div, `
        Did you prefer to use one type of code (purple vs. red/blue)? Why?
      `),

      feedback: text_box(div, `
        Do you have any other feedback? (optional)
      `)
    }

    // let special = radio_buttons(div, `
    //   Did you notice that some codes worked differently from others?
    // `, ['yes', 'no']
    // )

    // let special2 = text_box(div, `
    //   If so, please briefly explain what you noticed.
    // `,
    // )

    await button(div, 'submit').clicked
    logEvent('debrief.submitted', _.mapValues(feedback, x => x.val()))
  }
  
  if (urlParams.test) {    
    await main()
  }

  await runTimeline(
    instructions,
    survey,
    main,
    debrief
  )
};
