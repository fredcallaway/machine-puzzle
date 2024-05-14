const PROLIFIC_CODE = 'CH2Q1VIL'
const PARAMS = {
  middle: true
}

updateExisting(PARAMS, urlParams)
psiturk.recordUnstructuredData('params', PARAMS);


async function runExperiment() {
  let config
  if (PARAMS.middle) {
    console.log('MIDDLE NODE VERSION')
    config = await $.getJSON(`static/json/middle-${CONDITION+1}.json`)
  } else {
    config = await $.getJSON(`static/json/${CONDITION+1}.json`)
  }
  window.config = config
  _.extend(PARAMS, config)

  logEvent('experiment.initialize', {CONDITION, PARAMS})
  enforceScreenSize(1200, 750)

  async function instructions() {
    logEvent('experiment.instructions')
    await new MachineInstructions({
      ...PARAMS,
      colors: ['#FB9C9C', '#FAFB9C', '#A9D2FB'],
      chemicalNames: ['X', 'Y', 'Z'],
      nMode: 4,
      start: 0,
      goal: null,
      manualHeight: 150,
      transitions: [
        [-1, 0, -1],
        [0, -1, 2],
        [-1, 0, -1]
      ],
      recipes: [[0, 0, 1], [1, 2, 2]]
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

    let mp = new MachinePuzzle({...PARAMS, manualHeight: 150}).attach( $('<div>').appendTo(workspace))
    mp.goalBox.hide()
    mp.book.hide()
    await button(prompt).promise()

    prompt.html(markdown(`
      # A new machine

      Fortunately, we were able to scrap together some notes from the last operator of the machine.
      Hopefully, they will come in handy.
    `))
    mp.book.show()
    await button(prompt).promise()


    prompt.html(markdown(`
      # A new machine

      OK, that's it! You will complete a total of ${PARAMS.tasks.length} rounds. Good luck!
    `))
    await button(prompt, 'begin').promise()
  }


  async function main() {
    logEvent('experiment.main')
    DISPLAY.empty()

    let top = new TopBar({
      nTrial: PARAMS.tasks.length,
      height: 70,
      width: 1150,
      helpTitle: 'Feeling stuck?',
      help: `
        If you can't find a solution in the manual, you can always synthesize the goal
        chemical by brute force. Configure the machine to produce the goal chemical by
        clicking the corresponding button (with the same letter). Then try the operation
        modes one by one until you find the one that works.
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

  await runTimeline(
    instructions,
    social,
    main,
    debrief
  )
};
