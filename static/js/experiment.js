
const PARAMS = conditionParameters(CONDITION, {

})

updateExisting(PARAMS, urlParams)
psiturk.recordUnstructuredData('params', PARAMS);


async function runExperiment() {
  // stimuli = await $.getJSON(`static/json/${CONDITION}.json`)
  logEvent('experiment.initialize', {CONDITION, PARAMS})
  // enforceScreenSize(1200, 750)

  async function instructions() {
    logEvent('experiment.instructions')
    let trials = []
    await new MachineInstructions(trials).run(DISPLAY)
  }


  async function main() {
    logEvent('experiment.main')
    DISPLAY.empty()

    let top = new TopBar({
      nTrial: 10,
      height: 70,
      width: 1150,
      help: `
        Click a medicine (colorful circles at bottom) to fill the cauldron. Then click
        an herb (gray boxes) to attempt to make a new medicine.
      `
    }).prependTo(DISPLAY)

    let workspace = $('<div>').appendTo(DISPLAY)

    for (let trial of [1]) {
      new MachinePuzzle().run(workspace)
      await make_promise()
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
