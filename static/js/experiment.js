const PROLIFIC_CODE = 'CH2Q1VIL'
const PARAMS = {
  config_dir: "code-pilot",
  width: 6,
  height: 5,
  nClickBespoke: 10,
  nClickPartial: 7,
  buttonDelay: 1000,
  maxTotalTries: 300,
}

ERROR_EMAIL = 'fredcallaway@gmail.com'

async function runExperiment() {
  if (urlParams.draw) {
    _.extend(PARAMS, urlParams)
    new DrawingInterface(_.pick(PARAMS, 'width', 'height', 'blockSize', 'numScreens')).attach(DISPLAY)
    await make_promise()
  }
  let configFile = urlParams.test ? 
    'static/json/test.json' :
    `static/json/${PARAMS.config_dir}/${CONDITION}.json`
  try {
    config = await $.getJSON(configFile)
    console.log('config', config)
  } catch(err) {
    console.log("ERR HERE")
    throw new Error(`${configFile} does not exist`)
  }
  window.config = config // note I actually use this in instructions.js (HACK) but don't remove it!

  _.extend(PARAMS, config.params)
  _.extend(PARAMS, urlParams)
  psiturk.recordUnstructuredData('params', PARAMS);

  logEvent('experiment.initialize', {CONDITION, PARAMS})
  enforceScreenSize(1200, 750)

  if (PARAMS.maxTotalTries < 2 * PARAMS.nClickPartial * config.trials.length) {
    throw new Error("maxTotalTries is too low!")
  }

  async function instructions() {
    logEvent('experiment.instructions')
    await new MachineInstructions({
      ...config.instructions,
      mainParams: PARAMS,
    }).run(DISPLAY)
  }

  async function main() {
    logEvent('experiment.main')
    DISPLAY.empty()

    let top = new TopBar({
      nTrial: config.trials.length,
      height: 70,
      width: 1150,
      helpTitle: 'Feeling stuck?',
      help: `
        Check the manual to see if you have any usable information.
        Remember that you can combine codes from shapes that are built
        from the same parts as the one you're trying to crack. You 
        can also search for the code by repeatedly clicking the smart buttons.
        It should never take more than 20 clicks to find a valid code.
      `,
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
    main,
    debrief
  )
};
