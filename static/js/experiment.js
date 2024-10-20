const PROLIFIC_CODE = 'CH2Q1VIL'
const PARAMS = {
  config_dir: "asocial-1"
}

ERROR_EMAIL = 'fredcallaway@gmail.com'
updateExisting(PARAMS, urlParams)
psiturk.recordUnstructuredData('params', PARAMS);


async function runExperiment() {
  if (urlParams.draw) {
    new MachinePuzzle({...PARAMS, drawingMode: true}).run(DISPLAY)
    await make_promise()
  }
  // let configFile = `static/json/${PARAMS.config_dir}/${CONDITION+1}.json`
  let configFile = `static/json/config.json`
  try {
    config = await $.getJSON(configFile)
  } catch(err) {
    console.log("ERR HERE")
    throw new Error(`${configFile} does not exist`)
  }
  window.config = config
  console.log('manual', config.manual)
  // config.recipes = []

  _.extend(PARAMS, config.params)

  logEvent('experiment.initialize', {CONDITION, PARAMS})
  enforceScreenSize(1200, 750)

  async function instructions() {
    logEvent('experiment.instructions')
    await new MachineInstructions({
      ...PARAMS,
      // colors: ['#FB9C9C', '#FAFB9C', '#A9D2FB'],
    }).run(DISPLAY)
  }

  async function social() {
    let workspace = $('<div>').appendTo(DISPLAY)

    logEvent('experiment.main')
    let prompt = $('<div>').css({
      'max-width': 700,
      'min-height': 200,
      'margin': 'auto',
      'margin-bottom': 50,
    }).appendTo(workspace)
    .html(markdown(`
      # A new machine

      For the rest of the experiment, you'll be working on this more complex machine.
      It operates in the same way as the previous one, but it has more modes
      and works on different chemicals.
    `))

    let mp = new MachinePuzzle({...PARAMS}).attach($('<div>').appendTo(workspace))
    mp.goalBox.hide()
    mp.book.hide()
    await button(prompt).promise()

    if (config.recipes.length) {
      prompt.html(markdown(`
        # A new machine

        We've filled in your manual with some transformations used by previous operators of this machine.
      `))
      mp.book.show()
      await button(prompt).promise()
    }


    prompt.html(markdown(`
      # A new machine

      You will complete a total of ${PARAMS.trials.length} rounds. Good luck!
    `))
    await button(prompt, 'begin').promise()
  }


  async function main() {
    logEvent('experiment.main')
    DISPLAY.empty()

    let top = new TopBar({
      nTrial: PARAMS.trials.length,
      height: 70,
      width: 1150,
      helpTitle: 'Feeling stuck?',
      help: `
        You can always synthesize the goal chemical by brute force. Configure
        the machine to produce the goal chemical by clicking the
        corresponding button (with the same letter). Then try the operation
        modes one by one until you find the one that works.
      `
    }).prependTo(DISPLAY)

    registerEventCallback((info) => {
      if (info.event == "machine.struggling") {
        top.showHelp()
      }
    })

    let workspace = $('<div>').appendTo(DISPLAY)

    for (let trial of config.trials) {
      await new MachinePuzzle({manual: config.manual, ...trial}).run(workspace)
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
      Did you notice that any chemical was different from the others?
    `, ["I didn't notice", 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
    )

    let special2 = text_box(div, `
      If so, how was it different?
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
