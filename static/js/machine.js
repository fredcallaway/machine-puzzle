
// https://coolors.co/6394e7-e6c73e-2ccb24
const extractColors = (coolors) => coolors.split('/').pop().split("-").map(x => `#${x}`)


const COLORS = [
  'lightgray',
  ...extractColors("https://coolors.co/de6240-e69d3e-1faac9"),
  '#000000',
]



const COLOR_MAP = {
  'bespoke': COLORS[3],
  // 'bespoke': COLORS[3],
  'left': COLORS[1],
  'right': COLORS[2],
}

// const NEXT_CODE_COLOR = "#4abf41"
// const NEXT_CODE_DISABLED_COLOR = "#94c490"

const testBlock = `
11___22
_11222_
__112__
_11222_
11___22
`

function sampleInt(lo, hi) {
  if (typeof lo == 'undefined') {
    return lo  
  }
  return Math.floor(Math.random() * (hi - lo + 1)) + lo
}

function intNoise(amt) {
  return Math.floor(Math.random() * (amt * 2 + 1)) - amt
}

function randCode(maxDigit, codeLength, blocked='') {
  let code;
  if (typeof blocked == 'string') {
    const blockedString = blocked
    blocked = (code) => code == blockedString
  }
  for (let i = 0; i < 1000; i++) {
    code = Array(codeLength).fill().map(() => Math.floor(Math.random() * maxDigit) + 1).join('');
    if (!blocked(code)) return code
  }
  throw new Error(`Could not find a code that is not blocked`)
}

class MachineWrapper {
  constructor({params, shapes, codes}) {
    this.params = _.cloneDeep(params)
    this.shapes = shapes
    this.codes = codes
  }

  getPuzzle(opts={}) {
    let task = opts.task
    opts.manual = this.buildManual(opts.manual)
    assert(this.shapes[task], `unknown task: ${task}`)
    let solutions = opts.solutionKind
      ? { [this.codes[task][opts.solutionKind]]: opts.solutionKind }
      : { 
          [this.codes[task]["compositional"]]: "compositional",
          [this.codes[task]["bespoke"]]: "bespoke",
      }
    let blockString = this.shapes[task]
    let mp = new MachinePuzzle({
      ...this.params,
      task,
      solutions,
      blockString,
      ...opts,
    })
    return mp
  }

  buildManual(pairs) {
    if (!pairs) {
      return []
    }
    return pairs.map(([task, kind]) => this.manualEntry(task, kind))
  }

  manualEntry(task, kind) {
    return {
      task, blockString: this.shapes[task], compositional: kind == "compositional", code: this.codes[task][kind]
    }
  }  
}

class MachinePuzzle {
  
  constructor(options = {}) {
    // Assign default values and override with any options provided
    _.assign(
      this,
      {
        task: "null",
        solutions: {},
        manual: null,
        blockString: testBlock, // default block
        probRandComp: 0.05,
        allowAccidentalSolution: false,
        addSolutions: false,
        initialCode: "random",
        nClickBespoke: 20,
        nClickPartial: 15,
        nClickNoise: 1,
        buttonDelay: 1000, // delay after clicking next code button
        solutionDelay: 2000, // delay after showing solution
        maxDigit: null, // max digit allowed on each dial
        codeLength: 4,
        blockSize: 40,
        width: 8, // Width in block units, not including padding
        height: 5, // Height in block units, not including padding
        manualScale: 0.25,
        machineColor: "#707374",
        contentWidth: 1200,
        suppressSuccess: false,
        maxTries: 'default',
        trialID: randomUUID(), // unique trial ID
      },
      options
    )
    window.mp = this;
    if (this.maxTries == 'default') {
      this.maxTries = Math.max(50, this.nClickBespoke + this.nClickPartial * 2 + 20)
    }

    // compositional solution
    this.compositionalSolution = Object.entries(this.solutions).find(([_, type]) => type === 'compositional')?.[0];
    let split = this.codeLength / 2
    this.leftSolution = this.compositionalSolution?.slice(0, split)
    this.rightSolution = this.compositionalSolution?.slice(-split)

    // initialize state variables
    this.triedCodes = new Set()
    this.nTry = 0
    this.nDial = 0
    this.clicksLeft = {
      bespoke: this.nClickBespoke + intNoise(0),
      left: this.nClickPartial + intNoise(0),
      right: this.nClickPartial + intNoise(0),
    }
    this.done = make_promise(); // promise to resolve when the task is completed
    this.partialSolution = false
    if (this.initialCode == 'random') {
      this.initialCode = randCode(this.maxDigit, this.codeLength, (code) => this.getSolutionType(code))
    }
    this.logEvent('machine.initialize', _.pick(this, ['task', 'initialCode', 'solutions', 'blockString', 'manual']))
    
    // layout
    this.screenWidth = (this.width + 2) * this.blockSize; // +2 for padding
    this.screenHeight = (this.height + 2) * this.blockSize; // +2 for padding
    this.machineWidth = this.screenWidth + 100;
    this.machineHeight = this.screenHeight + 200;
    
    // build UI
    this.div = $("<div>").addClass('puzzle-container').css({
      display: 'flex',
      justifyContent: 'space-between',
      width: this.contentWidth + 'px',
      margin: '0 auto'
    });
    this.createMachine();
    this.createDials();
    this.drawTarget()
    this.createButtons()
    this.createManual()
  }

  logEvent(event, info = {}) {
    info.trialID = this.trialID;
    logEvent(event, info);
  }
  
  attach(display) {
    display.empty(); // clear the display
    this.div.appendTo(display); // attach the main div to the display
    return this;
  }
  
  async run(display) {
    this.logEvent('machine.run');
    if (display) this.attach(display); // attach the display if provided
    await this.done; // wait until the puzzle is completed
    const code = this.getCode()
    this.logEvent('machine.done', {code, solutionType: this.getSolutionType(code)})
  }

  createMachine() {
    this.machineDiv = $("<div>")
      .addClass("machine-div")
      .css({
        width: this.machineWidth + "px",
        height: this.screenHeight + 260 + "px",
        paddingLeft: this.blockSize + "px",
        paddingRight: this.blockSize + "px",
        backgroundColor: this.machineColor,
        userSelect: 'none',
      }).appendTo(this.div)

    // this.light = $("<div>")
    //   .css({
    //     width: 20,
    //     height: 20,
    //     borderRadius: "100%",
    //     position: "absolute",
    //     left: 10,
    //     top: 10,
    //     backgroundColor: "rgba(255, 255, 255, 0.5)",
    //     transition: "background-color 0.2s ease"
    //   })
    //   .appendTo(this.machineDiv)

    this.screen = $('<canvas></canvas>').attr({
      width: this.screenWidth,
      height: this.screenHeight
    }).css({
      'border': '3px solid black',
      'margin': '10px auto',
      'margin-top': this.blockSize,
      'display': 'block',
      'border-radius': '10px',
      'background-color': 'white',
      'position': 'relative',
    }).appendTo(this.machineDiv)  

    this.animationCanvas = $('<canvas></canvas>').attr({
      width: this.screenWidth,
      height: this.screenHeight
    }).css({
      'border': '3px solid transparent',
      'position': 'absolute',
      'top': this.blockSize + 'px',
      'left': '50%',
      'transform': 'translateX(-50%)',
      'pointer-events': 'none',
    }).appendTo(this.machineDiv)

    this.ctx = this.screen[0].getContext('2d');
    this.animationCtx = this.animationCanvas[0].getContext('2d');
  }

  drawTarget(mode='target') {
    this.drawShape(this.ctx, this.blockString, mode);
  }

  drawShape(ctx, blockString, mode, manual=false) {
    let blockSize = manual ? this.blockSize * this.manualScale : this.blockSize
    
    // Clear the screen (canvas context)
    if (mode == 'blank') {
      ctx.clearRect(0, 0, this.screenWidth, this.screenHeight);
      return
    }

    if (mode == 'compositional' || mode == 'left' || mode == 'right') {
      let blocks = string2blockSplit(blockString, 1, 1)

      if (mode == 'left') {
        blocks[1].color = COLORS[0]
      } else if (mode == 'right') {
        blocks[0].color = COLORS[0]
      }
      for (const b of blocks) {
        b.draw(ctx, blockSize);
      }
    } else {
      let color = mode == 'bespoke' ? 3 : 0
      let block = string2block(blockString, 1, 1, color)
      window.block = block
      // block.x = (this.screenWidth / this.blockSize - block.width) / 2
      // block.y = (this.screenHeight / this.blockSize - block.height) / 2
      block.draw(ctx, blockSize);
    }
  }

  createDials() {
    let dialWidth = 60;
    this.dialContainerWidth = this.codeLength * dialWidth;

    let dialContainer = this.dialContainer = $('<div></div>')
      .addClass('dial-container')
      .css('width', `${this.dialContainerWidth}px`);

    this.numberEls = [];

    for (let i = 0; i < this.codeLength; i++) {
        let dialWrapper = $('<div></div>')
          .addClass('dial')
          .attr('id', `dial-${i}`);

        let side = i >= this.codeLength / 2 ? "right" : "left"

        let select = $('<select></select>')
          .addClass(`dial-select dial-select-${i} dial-select-${side}`)
          .css('font-size', `${40 - this.codeLength * 2}px`);

        // Add options 1 through maxDigit
        for (let j = 1; j <= this.maxDigit; j++) {
            select.append($('<option></option>').val(j).text(j));
        }

        select.val(this.initialCode[i]);
        select.on('change', () => {
            this.lastAction = `select.${i}`;
            this.logEvent(`machine.select.${i}`)
            this.checkCode();
        });

        this.numberEls.push(select);
        dialWrapper.append(select);
        dialContainer.append(dialWrapper);

        if (i < this.codeLength - 1) {
            dialContainer.append($('<div></div>').addClass('dial-separator'));
        }
    }

    this.machineDiv.append(dialContainer);
  }

  getCode() {
    return this.numberEls.map(el => el.val()).join('')
  }
  setCode(code) {
    this.numberEls.forEach((el, idx) => {
      el.val(code[idx])
    })
  }

  async createButtons() {
    this.buttonDiv = $('<div>')
      .addClass('code-btn-container')
      .css({ width: this.dialContainerWidth })
      .appendTo(this.machineDiv)

    for (let kind of ['left', 'right', 'bespoke']) {
      $("<button>")
        .addClass(`code-btn code-btn-${kind}`)
        .css({ backgroundColor: COLOR_MAP[kind] })
        .on('click', async (e) => {
          if (this._lockReason) return
          if (this.altNextCode) {  // TODO instructions can just lock
            this.altNextCode()
            return
          }
          this.handleButton(kind);
        })
        .appendTo(this.buttonDiv)
    }

    // if (this.buttonDelay) {
    //   await sleep(0)  // wait for the buttons to be created
    //   $('.code-btn').on('click', async (e) => {
    //     if (this._lockReason) return
    //     $(e.currentTarget).addClass('clicked')
    //     this.lockInput('delay')
    //     this.buttonDelay = 2000
    //     await sleep(this.buttonDelay)
    //     $(e.currentTarget).removeClass('clicked')
    //     this.unlockInput('delay')
    //   })
    // }
  }

  async animateSearch(kind) {
    this.lockInput('delay')

    const changed = kind == 'bespoke' ? ['left', 'right'] : [kind]
    if (changed.includes(this.partialSolution)) {
      this.drawTarget()
    }
    $(`.code-btn-${kind}`).addClass('clicked')
    $(`.code-btn-${kind}`).removeClass('solved')

    for (let k of changed) {
      $(`.dial-select-${k}`).css('color', 'black')
    }

    let done = make_promise()
    sleep(this.buttonDelay).then(() => done.resolve())
    const animate = () => {
      if (done.resolved) return
      this.setCode(this.generateCode(kind))
      requestAnimationFrame(animate)
    }
    animate()
    await done
        
    $(`.code-btn-${kind}`).removeClass('clicked')
    this.unlockInput('delay')
  }

  getSolutionType(code) {
    let full = this.solutions[code]
    if (full) return full
    return code.startsWith(this.leftSolution) ? "left" :
      code.endsWith(this.rightSolution) ? "right" :
      false
  }

  generateCode(kind, mode='rand') {
    let code = this.getCode()
    if (kind == 'bespoke') {
      if (mode == 'correct') {
        return _.sample(Object.keys(this.solutions))
      } else if (mode == 'rand') {
        return randCode(this.maxDigit, this.codeLength, (code) => this.getSolutionType(code))
      } else if (mode == 'incorrect') {
        return randCode(this.maxDigit, this.codeLength, (code) => this.getSolutionType(code))
      } else {
        assert(false, `invalid args to generateCode: ${kind} ${mode}`);
      }
    } else {
      const partial = () => {
        switch (`${kind}-${mode}`) {
          case 'left-correct': return this.leftSolution;
          case 'right-correct': return this.rightSolution;
          case 'left-rand': return randCode(this.maxDigit, this.leftSolution.length);
          case 'right-rand': return randCode(this.maxDigit, this.rightSolution.length);
          case 'left-incorrect': return randCode(this.maxDigit, this.leftSolution.length, this.leftSolution);
          case 'right-incorrect': return randCode(this.maxDigit, this.rightSolution.length, this.rightSolution);
        }
      }
  
      if (kind == 'left') {
        return partial() + code.slice(this.rightSolution.length)
      } else if (kind == 'right') {
        return code.slice(0, this.leftSolution.length) + partial()
      } else {
        assert(false, `invalid args to generateCode: ${kind} ${mode}`);
      }
    }
  }

  getNextCode(kind) {
    // if we've hit the limit on pulls, reveal the solution
    if (this.clicksLeft[kind] <= 0) {
      return this.generateCode(kind, 'correct')
    }
    let code
    let mode = this.allowAccidentalSolution ? 'rand' : 'incorrect'
    for (let j = 0; j < 1000; j++) {
      code = this.generateCode(kind, mode)
      if (!this.triedCodes.has(code)) {
        return code
      }
    }
    // This really shouldn't happen
    this.logEvent("machine.WARNING.getNextCode.failure")
    return this.generateCode(kind, 'correct')
  }
  
  async handleButton(kind) {
    this.logEvent(`machine.button.${kind}`)
    await this.animateSearch(kind)
    this.lastAction = `nextCode.${kind}`
    this.clicksLeft[kind] -= 1
    this.setCode(this.getNextCode(kind))
    this.checkCode()
  }

  addSolutionToManual(entry) {
    if (this.manual == null) return
    if (typeof entry == 'string') {
      entry = {
        task: this.task,
        blockString: this.blockString,
        compositional: entry == "compositional",
        code: this.getCode(),
      }
    }

    if (typeof entry.blockString !== 'string' || entry.blockString.trim() === '') {
      console.error('Invalid entry: blockString must be a non-empty string');
      return;
    }

    // Check if this entry already exists in the manual
    const existingEntry = this.manual.find(e2 => 
      e2.task === entry.task &&
      e2.compositional === entry.compositional
    );
    
    // If the entry doesn't exist, add it to the manual
    if (!existingEntry) {
      this.manual.push(entry)
      this.addExampleToManual(entry)
      this.logEvent('machine.manual.update', entry);
    }
  }

  async flashScreen() {
    let speeds = Array(10).fill().map((_, i) => Math.round(150 + 400 / (1 + Math.exp(i * 0.8))))
    for (let speed of speeds) {
      this.screen.css("transition", `background-color ${speed}ms ease`)
      await sleep(speed)
      this.screen.css("background-color", "#555")
      await sleep(speed)
      this.screen.css("background-color", "#fff")
    }
  }

  async animateSolution(solutionType, prevSolution) {
    const squareSize = this.blockSize;

    const drawSquare = (x, y, on=true) => {
      this.animationCtx.fillStyle = '#333'
      let args = [(x) * squareSize, (y) * squareSize, squareSize, squareSize]
      if (on) {
        this.animationCtx.fillRect(...args)
      } else {
        this.animationCtx.clearRect(...args)
      }
    }
    this.drawTarget(solutionType)
    this.drawShape(this.animationCtx, this.blockString, prevSolution)

    // await sleep(500)
    // for (let i = 0; i < 2; i++) {
    //   drawSquare(0, 0, true)
    //   await sleep(150)
    //   drawSquare(0, 0, false)
    //   await sleep(150)
    // }
    // drawSquare(0, 0, true)

    let t = Date.now()
    
    const delay = this.solutionDelay / ((this.height+2) * (this.width+2))
    // const delay = 40
    for (let y = 0; y < this.height+2; y++) {
      const xRange = y % 2 === 0 
        ? _.range(0, this.width +2)
        : _.range(this.width + 1, -1, -1);
        
      for (let x of xRange) {
        drawSquare(x, y, true)
        await sleep(delay);
        drawSquare(x, y, false)
      }
    }
    this.animationCtx.clearRect(0, 0, this.screenWidth, this.screenHeight);
    this.logEvent(`machine.animationDone`, {duration: Date.now() - t})
  }

  updateDialColors(solutionType) {
    $(".dial-select").css('color', 'black')
    if (solutionType === "compositional") {
      $(".dial-select-left").css('color', COLOR_MAP.left)
      $(".dial-select-right").css('color', COLOR_MAP.right)
    } else if (solutionType === "left") {
      $(".dial-select-left").css('color', COLOR_MAP.left)
    } else if (solutionType === "right") {
      $(".dial-select-right").css('color', COLOR_MAP.right)
    } else if (solutionType === "bespoke") {
      $(".dial-select").css('color', COLOR_MAP.bespoke)
    }
  }

  async showSolution(solutionType, opts = {}) {
    const prevSolution = this.partialSolution
    this.partialSolution = solutionType
    this.updateDialColors(solutionType)

    if (!solutionType) {
      this.logEvent("machine.undo-partial")
      $(`.code-btn-${solutionType}`).removeClass("solved")
      this.drawTarget()
      return
    }

    $(`.dial-select.${solutionType}`).addClass('solved')
      
    this.lockInput('showSolution')
    assert(solutionType, "invalid solutionType: " + solutionType)
    this.logEvent(`machine.solution.${solutionType}`, {code: this.getCode()})

    // Mark button as solved
    $(`.code-btn-${solutionType}`).addClass('solved')
    
    if (opts.skipAnimation) {
      this.drawTarget(solutionType)
    } else {
      await this.animateSolution(solutionType, prevSolution)
    }

    if (solutionType == "compositional" || solutionType == "bespoke") {
      if (this.addSolutions) {
        this.addSolutionToManual(solutionType)
      }
      // party parrot
      $("<img>", { src: "static/img/parrot.gif", id: "parrot" })
        .css({
          position: "absolute",
          left: 0,
          top: -53,
          width: 50,
          zIndex: 10,
        })
        .appendTo(this.machineDiv)
      await sleep(500)
      if (!this.suppressSuccess) {
        await alert_success()
      }
      this.done.resolve()
    } else {
      this.unlockInput('showSolution')
    }
  }

  lockInput(reason = 'none') {
    this._lockReason = reason
    $('.code-btn').addClass('locked')
    $('.code-btn.clicked').removeClass('locked')
    $(".dial-select").addClass('locked')
  }
  
  unlockInput(reason = 'none') {
    if (this._lockReason != reason) return
    assert(this._lockReason)
    this._lockReason = undefined
    $(".code-btn").removeClass('locked clicked')
    $(".dial-select").removeClass('locked')
    // if (this.partialSolution) {
    //   $(".dial-select-" + this.partialSolution).css('pointer-events', 'off')
    //   $(`.code-btn-${this.partialSolution}`)
    //     .addClass('locked')
    // }
  }

  checkCode() {
    this.nTry += 1

    let code = this.getCode()
    this.triedCodes.add(code)
    this.logEvent("machine.enter", { code, action: this.lastAction })

    let sol = this.getSolutionType(code)
    if (!sol && this.nTry > this.maxTries) {
      terminateExperiment("hitmax", { nTry: this.nTry, clicksLeft: this.clicksLeft })
    } else if (sol != this.partialSolution) {
      this.showSolution(sol)
    } 
  }

  createManual() {
    // Create the manual div
    this.manualDiv = $("<div>")
      .addClass("manual-div")
      .css({
        width: this.contentWidth - this.machineWidth - 50 + "px",
      }).appendTo(this.div)
      
    $("<h3>").text("Manual").css({
      "text-align": "left",
      "margin-left": "10px",
      "margin-bottom": "5px",
      "margin-top": "-30px",
    }).appendTo(this.manualDiv)

    const manualContainer = $("<div>").addClass("manual-container").css({
      border: "2px solid black",
      padding: "10px",
      "border-radius": "10px",
      "background-color": "white",
      height: "100%",
      "box-sizing": "border-box",
    })

    this.examplesContainer = $("<div>").css({
      display: "flex",
      "justify-content": "flex-start",
      "flex-wrap": "wrap",
    })

    this.manual.forEach((example) => {
      this.addExampleToManual(example)
    })

    manualContainer.append(this.examplesContainer)
    this.manualDiv.append(manualContainer) // Append to manualDiv instead of div
  }

  addExampleToManual(example) {
    const exampleDiv = $("<div>").css({
      "text-align": "center",
      margin: "10px",
    })

    const canvas = $("<canvas>").attr({
      width: this.screenWidth * this.manualScale,
      height: this.screenHeight * this.manualScale,
    })

    const ctx = canvas[0].getContext("2d")
    this.drawShape(
      ctx,
      example.blockString,
      example.compositional ? "compositional" : "bespoke",
      true
    )

    const codeText = $("<p>").css({
      "margin-top": "5px",
      display: "flex",
      "justify-content": "center",
      "align-items": "center",
      "font-weight": "bold",
      "font-size": "30px",
    })
    // codeText.css('visibility', 'hidden')
    // exampleDiv.on('mouseenter', () => {
    //   codeText.css('visibility', 'visible')
    // })
    // exampleDiv.on('mouseleave', () => {
    //   codeText.css('visibility', 'hidden')
    // })

    assert(this.codeLength == 4, "codeLength is assumed to be 4 here")
    const colors = example.compositional ? [1, 1, 2, 2] : [3, 3, 3, 3]
    example.code.split("").forEach((digit, idx) => {
      const digitSpan = $("<span>")
        .text(digit)
        .css("color", COLORS[colors[idx]])
      codeText.append(digitSpan)
    })

    exampleDiv.append(canvas, codeText)
    this.examplesContainer.append(exampleDiv)
  }

  setLight(color) {
    this.light.css("backgroundColor", color);
    if (color !== "rgba(255, 255, 255, 0.5)") {
      setTimeout(() => this.setLight("rgba(255, 255, 255, 0.5)"), 500);
    }
  }
}


class Block {
  constructor({ x, y, parts, color, id } = {}) {
    this.x = x
    this.y = y
    this.parts = parts // Array of {x, y} parts relative to the block's position
    this.color = color
    this.id = id
    this.colliding = false
    this.rotation = 0 // just for analysis convenience
    this.width =
      _(this.parts)
        .map((part) => part.x)
        .max() + 1
    this.height =
      _(this.parts)
        .map((part) => part.y)
        .max() + 1
  }

  draw(ctx, grid) {
    // Draw individual parts with a thin outline
    ctx.fillStyle = this.colliding
      ? `rgba(${hex2rgb(this.color)},0.2)`
      : this.color // Set transparency on collision
    this.parts.forEach((part) => {
      const partX = (this.x + part.x) * grid
      const partY = (this.y + part.y) * grid
      ctx.fillRect(partX, partY, grid, grid)
      // light border on each tile
      // ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      // ctx.lineWidth = 1 + (grid / 30);
      // ctx.strokeRect(partX, partY, grid, grid);
    })

    // Now, draw the thick border around the shape
    ctx.strokeStyle = this.colliding ? "rgba(0,0,0,0.2)" : "black"
    ctx.lineWidth = 1 + grid / 30
    // Helper function to check if there is an adjacent part
    const hasAdjacentPart = (dx, dy) => {
      return this.parts.some((part) => part.x === dx && part.y === dy)
    }

    this.parts.forEach((part) => {
      const partX = (this.x + part.x) * grid
      const partY = (this.y + part.y) * grid

      // For each side of the part, draw a line if there is no adjacent part
      if (!hasAdjacentPart(part.x, part.y - 1)) {
        // No part above, draw top line
        ctx.beginPath()
        ctx.moveTo(partX, partY)
        ctx.lineTo(partX + grid, partY)
        ctx.stroke()
      }
      if (!hasAdjacentPart(part.x + 1, part.y)) {
        // No part to the right, draw right line
        ctx.beginPath()
        ctx.moveTo(partX + grid, partY)
        ctx.lineTo(partX + grid, partY + grid)
        ctx.stroke()
      }
      if (!hasAdjacentPart(part.x, part.y + 1)) {
        // No part below, draw bottom line
        ctx.beginPath()
        ctx.moveTo(partX, partY + grid)
        ctx.lineTo(partX + grid, partY + grid)
        ctx.stroke()
      }
      if (!hasAdjacentPart(part.x - 1, part.y)) {
        // No part to the left, draw left line
        ctx.beginPath()
        ctx.moveTo(partX, partY)
        ctx.lineTo(partX, partY + grid)
        ctx.stroke()
      }
    })
  }
}

function string2block(s, x, y, color, id = "block") {
  if (s == "blank") {
    s = BLANK
  }
  if (typeof color == "number") {
    color = COLORS[color]
  }
  let rows = s.trim().split("\n")
  let parts = []
  rows.forEach((row, y) => {
    row
      .trim()
      .split("")
      .forEach((v, x) => {
        if (v != "_" && v != " ") {
          parts.push({ x, y })
        }
      })
  })
  return new Block({ x, y, parts, color, id })
}

function string2blockSplit(s, x, y) {
  let rows = s.trim().split("\n")
  let parts = {}
  rows.forEach((row, y) => {
    row
      .trim()
      .split("")
      .forEach((v, x) => {
        if (v != "_" && v != " ") {
          if (parts[v] === undefined) {
            parts[v] = []
          }
          parts[v].push({ x, y })
        }
      })
  })
  return Object.entries(parts).map(
    ([v, bparts]) => new Block({ x, y, parts: bparts, color: COLORS[v] })
  )
}
