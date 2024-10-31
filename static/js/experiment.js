const PROLIFIC_CODE = 'CH2Q1VIL'
const PARAMS = {
  config_dir: "code-pilot",
  maxTryPartial: 100,
  nextCodeDelay: 100,
  maxTotalTries: 600,
}

ERROR_EMAIL = 'fredcallaway@gmail.com'
updateExisting(PARAMS, urlParams)
psiturk.recordUnstructuredData('params', PARAMS);


async function runExperiment() {
  if (urlParams.draw) {
    new DrawingInterface({}).attach(DISPLAY)
    await make_promise()
  }
  let configFile = `static/json/${PARAMS.config_dir}/${CONDITION}.json`
  try {
    config = await $.getJSON(configFile)
  } catch(err) {
    console.log("ERR HERE")
    throw new Error(`${configFile} does not exist`)
  }
  window.config = config

  _.extend(PARAMS, config.params)

  logEvent('experiment.initialize', {CONDITION, PARAMS})
  enforceScreenSize(1200, 750)

  async function instructions() {
    logEvent('experiment.instructions')
    await new MachineInstructions({
      ...PARAMS,
    }).run(DISPLAY)
  }

  async function social() {
    if (config.params.manual.length == 0) return
    logEvent('experiment.social')
    
    let workspace = $('<div>').appendTo(DISPLAY)
    let prompt = $('<div>').css({
      'max-width': 700,
      // 'min-height': 100,
      'margin': 'auto',
      'margin-bottom': 20,
    }).appendTo(workspace)

    let mp = new MachinePuzzle({...PARAMS}).attach($('<div>').appendTo(workspace))
    mp.machineDiv.hide()
    mp.manualDiv.css('margin', 'auto')

    prompt.html(markdown(`
      # Instructions complete

      You're now ready to start the main experiment. 
      There will be ${config.trials.length} rounds.
      Try to complete them all as quickly as possible, using the manual as much as you can.
      To start you off, we've filled in your manual with some codes used by previous operators of this machine.
    `))
    await button(prompt).promise()
  }


  async function main() {
    logEvent('experiment.main')
    DISPLAY.empty()

    let top = new TopBar({
      nTrial: config.trials.length,
      height: 70,
      width: 1150,
      // helpTitle: 'Feeling stuck?',
      // help: `
      //   Check the manual to see if you have any usable information.
      //   Remember that you can combine codes from shapes that are built
      //   from the same parts as the one you're trying to crack!
        
      //   You can always find a code by brute force. Just repeatedly click on
      //   the rightmost dial (the last digit) and you will eventually find one
      //   of the correct codes. It should never require more than ${Math.max(250, PARAMS.maxTryPartial)} clicks. 
      //   If that doesn't work, there's probably a bug in the experiment. Please
      //   submit your study without a completion code and message us on Prolific.
      //   If you can, email ${ERROR_EMAIL} as well so we can fix it ASAP!
      // `
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
    social,
    main,
    debrief
  )
};
