const PROLIFIC_CODE = 'CH2Q1VIL'
const PARAMS = {
  config_dir: "code-pilot",
  maxTryPartial: 100,
  // nextCodeDelay: 100,
  maxTotalTries: 700,
  width: 6,
  height: 5,
}

ERROR_EMAIL = 'fredcallaway@gmail.com'
_.extend(PARAMS, urlParams)
psiturk.recordUnstructuredData('params', PARAMS);


async function runExperiment() {
  if (urlParams.draw) {
    new DrawingInterface(_.pick(PARAMS, 'width', 'height', 'blockSize', 'numScreens')).attach(DISPLAY)
    await make_promise()
  }
  let configFile = `static/json/${PARAMS.config_dir}/${CONDITION}.json`
  try {
    config = await $.getJSON(configFile)
    console.log('config', config)
  } catch(err) {
    console.log("ERR HERE")
    throw new Error(`${configFile} does not exist`)
  }
  window.config = config // note I actually use this in instructions.js (HACK) but don't remove it!

  _.extend(PARAMS, config.params)

  logEvent('experiment.initialize', {CONDITION, PARAMS})
  enforceScreenSize(1200, 750)

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
        from the same parts as the one you're trying to crack! You 
        can also search for the code by repeatedly clicking the green button.
        It may take a while, but you will eventually find it!
      `,
    }).prependTo(DISPLAY)

    let totalTries = 0

    registerEventCallback(async (info) => {
      if (info.event == "machine.enter.incorrect") {
        totalTries += 1
        if (totalTries == PARAMS.maxTotalTries) {
          logEvent('experiment.tooManyTries', {totalTries})
          terminateExperiment("Code Not Found")
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
    `))

    let special = radio_buttons(div, `
      Did you notice that some codes worked differently from others?
    `, ['yes', 'no']
    )

    let special2 = text_box(div, `
      If so, please briefly explain what you noticed.
    `,
    )

    let feedback = text_box(div, `
      Do you have any other feedback? (optional)
    `)

    await button(div, 'submit').clicked
    logEvent('debrief.submitted', {
      special: special.val(),
      special2: special2.val(),
      feedback: feedback.val(),
    })
  }

  await runTimeline(
    instructions,
    main,
    debrief
  )
};
