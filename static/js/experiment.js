
const PARAMS = conditionParameters(CONDITION, {

})

updateExisting(PARAMS, urlParams)
psiturk.recordUnstructuredData('params', PARAMS);


async function runExperiment() {
  let config = await $.getJSON(`static/json/${CONDITION+1}.json`)
  window.config = config
  _.extend(PARAMS, config)

  logEvent('experiment.initialize', {CONDITION, PARAMS})
  // enforceScreenSize(1200, 750)

  async function instructions() {
    logEvent('experiment.instructions')
    await new MachineInstructions(PARAMS).run(DISPLAY)
  }


  async function main() {
    logEvent('experiment.main')
    DISPLAY.empty()

    let top = new TopBar({
      nTrial: PARAMS.tasks.length,
      height: 70,
      width: 1150,
      help: `
        Create the goal chemical to move on to the next round.
        Click on a chemical (colorful cricles) to place it in the machine.
        Click a numbered box to activate a mode. Then click the lever to
        activate the machine.
      `
    }).prependTo(DISPLAY)

    let workspace = $('<div>').appendTo(DISPLAY)

    for (let [start, goal] of config.tasks) {
      await new MachinePuzzle({...PARAMS, start, goal}).run(workspace)
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

    let difficulty = radio_buttons(div, `
      How difficult were the problems, overall?
    `, ['too easy', 'just right', 'too hard'])

    let feedback = text_box(div, `
      Do you have any other feedback? (optional)
    `)

    await button(div, 'submit').clicked
    logEvent('debrief.submitted', {
      difficulty: difficulty.val(),
      feedback: feedback.val(),
    })
  }

  async function runTimeline(...blocks) {
    let start = _.map(blocks, 'name').indexOf(urlParams.block)
    if (start != -1) {
      blocks = blocks.slice(start)
    }
    for (const block of blocks) {
      await block()
    }
  }

  await runTimeline(
    instructions,
    main,
    debrief
  )
};
