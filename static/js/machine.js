const COLORS = [
  'lightgray',
  '#548df0',
  '#e96060',
  '#b46cc6',
  '#000000',
]

const NEXT_CODE_COLOR = "#4abf41"
const NEXT_CODE_DISABLED_COLOR = "#94c490"

const testBlock = `
11___22
_11222_
__112__
_11222_
11___22
`

function sampleUniform(rng) {
  if (typeof rng == 'number') {
    return rng  
  }
  return Math.floor(Math.random() * (rng[1] - rng[0] + 1)) + rng[0]
}

function randCode(maxDigit, codeLength) {
  let code = Array(codeLength).fill().map(() => Math.floor(Math.random() * maxDigit) + 1);
  return code.join('')
}

class MachinePuzzle {
  
  constructor(options = {}) {
    // Assign default values and override with any options provided
    _.assign(
      this,
      {
        task: "null",
        solutions: {
          1112: "compositional",
          1121: "bespoke",
        },
        manual: null,
        blockString: testBlock, // default block
        dialSpeed: 0.03, // speed of dial drag
        clickTime: 200, // time threshold for a quick click
        nextCodeDelay: 300, // delay after clicking next code button
        maxDigit: null, // max digit allowed on each dial
        trialID: randomUUID(), // unique trial ID
        blockSize: 40,
        width: 8, // Width in block units, not including padding
        height: 5, // Height in block units, not including padding
        maxTry: 100,
        maxTryPartial: 10,
        manualScale: 0.25,
        initialCode: "random",
        machineColor: "#707374",
        allowClicks: false,
        suppressSuccess: false,
        showNextCodeButton: true,
        showLocks: false,
        showManual: true,
        codeLength: 4,
        contentWidth: 1200,
      },
      options
    )
    window.mp = this;
    // if (this.drawingMode) {
    //   this.width = 30
    //   this.height = 30
    //   this.blockSize = 30
    // }
    
    // initialize state variables
    this.dialLocked = Array(this.codeLength).fill(false)
    this.triedCodes = new Set()
    this.nTry = 0
    this.nTryPartial = 0
  
    this.compositionalSolution = Object.entries(this.solutions).find(([_, type]) => type === 'compositional')?.[0];
    let split = this.codeLength / 2
    this.leftSolution = this.compositionalSolution?.slice(0, split)
    this.rightSolution = this.compositionalSolution?.slice(-split)
    
    if (this.initialCode == 'random') {
      do {
        this.initialCode = randCode(this.maxDigit, this.codeLength);
      } while (this.getSolutionType(this.initialCode));
    }
    
    this.screenWidth = (this.width + 2) * this.blockSize; // +2 for padding
    this.screenHeight = (this.height + 2) * this.blockSize; // +2 for padding
    this.machineWidth = this.screenWidth + 100;
    this.machineHeight = this.screenHeight + 200;
    
    this.div = $("<div>").addClass('puzzle-container').css({
      display: 'flex',
      justifyContent: 'space-between',
      width: this.contentWidth + 'px',
      margin: '0 auto'
    });
    this.createMachine();
    
    this.logEvent('machine.initialize', _.pick(this, ['task', 'initialCode', 'solutions', 'blockString', 'manual']))
    this.done = make_promise(); // promise to resolve when the task is completed
    this.partialSolution = false // state variable

    this.createDials();
    this.drawTarget()
    if (this.showNextCodeButton) this.createButtons()
    if (this.showLocks) this.createLocks()
    if (this.showManual && this.manual != null) this.createManual()
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
    this.logEvent('machine.done')
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

    this.light = $("<div>")
      .css({
        width: 20,
        height: 20,
        borderRadius: "100%",
        position: "absolute",
        left: 10,
        top: 10,
        backgroundColor: "rgba(255, 255, 255, 0.5)",
        transition: "background-color 0.2s ease"
      })
      .appendTo(this.machineDiv)

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
    let containerWidth = this.dialContainerWidth = this.codeLength * dialWidth;

    let dialContainer = this.dialContainer = $('<div></div>').css({
        'display': 'flex',
        'justify-content': 'space-between',
        'align-items': 'center',
        'margin-top': '20px',
        'border-radius': '10px',
        'border': '3px solid black',
        'padding': '10px',
        'width': `${containerWidth}px`,
        'height': '60px',
        'position': 'relative',
        'margin-left': 'auto',
        'margin-right': 'auto',
        'overflow': 'hidden',
        'background': 'white',
    });

    this.numberEls = [];

    for (let i = 0; i < this.codeLength; i++) {
        let dialWrapper = $('<div></div>').addClass('dial').attr('id', `dial-${i}`).css({
            'flex': '1',
            'text-align': 'center',
            'height': '100%',
            'display': 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'width': 'auto'
        });

        let side = i >= this.codeLength / 2 ? "right" : "left"

        let select = $('<select></select>')
          .addClass(`dial-select dial-select-${i} dial-select-${side}`)
          .css({
            'font-size': `${40 - this.codeLength * 2}px`,
            'font-weight': 'bold',
            'border': 'none',
            'width': '100%',
            'outline': 'none',
            'background': 'transparent',
            'text-align': 'center',
            'text-align-last': 'center',
            '-webkit-appearance': 'none',
            '-moz-appearance': 'none',
            'cursor': 'pointer'
        });

        // Add options 1 through maxDigit
        for (let j = 1; j <= this.maxDigit; j++) {
            select.append($('<option></option>').val(j).text(j));
        }

        select.val(this.initialCode[i]);

        select.on('change', () => {
            this.lastAction = `select.${i}`;
            this.checkCode();
        });

        this.numberEls.push(select);
        dialWrapper.append(select);
        dialContainer.append(dialWrapper);

        // Add separator line between dials (except the last one)
        if (i < this.codeLength - 1) {
            dialContainer.append($('<div></div>').css({
                'height': '30px',
                'width': '2px',
                'background-color': 'lightgray',
                'margin': '0 5px',
                'align-self': 'center'
            }));
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

  
  createLocks() {
    // Add lock icons below each dial
    const lockContainer = $("<div>")
      .css({
        display: "flex",
        "justify-content": "space-around",
        width: `${this.dialContainerWidth}px`,
        "margin-bottom": "20px",
        "margin-top": "10px",
        "margin-left": "auto",
        "margin-right": "auto",
      })
      .appendTo(this.machineDiv)

    for (let i = 0; i < this.codeLength; i++) {
      const lockIcon = $("<i>")
        .addClass("fas fa-lock-open")
        .css({
          "font-size": "20px",
          color: NEXT_CODE_COLOR,
          cursor: "pointer",
          width: "20px", // Set a fixed width
          "text-align": "center", // Center the icon within its container
          display: "inline-block", // Ensure inline-block display
        })
        .on("click", () => {
          if (lockIcon.hasClass("fa-lock")) {
            this.logEvent("machine.locks.unlock", { 
              dial: i })
            lockIcon
              .removeClass("fa-lock")
              .addClass("fa-lock-open")
              .css({ color: NEXT_CODE_COLOR })
            this.dialLocked[i] = false
          } else {
            this.logEvent("machine.locks.lock", { dial: i })
            lockIcon
              .removeClass("fa-lock-open")
              .addClass("fa-lock")
              .css({ color: "black" })
            this.dialLocked[i] = true
          }
        })
        .appendTo(lockContainer)
    }
  }

  async createButtons() {
    const css = {
      'color': 'white',
      'font-weight': 'bold',
      'background-color': NEXT_CODE_COLOR,
      // 'transition': 'background-color 0.02s ease',
      'outline': 'none',
      'cursor': 'pointer',
      'border': '3px solid black',
      'border-radius': '10px',
      // 'position': 'absolute',
      // 'right': '30px',  // Adjust this value as needed to position the button correctly
      // 'top': this.blockSize + this.screenHeight + 35,
      'margin': '10px 10px 0px',
      'font-size': '25px',
      'cursor': 'pointer'
    }
    this.nextCodeButton = $('<button>')
      .addClass('code-button')
      .text('?')
      .css({...css, 'width': this.dialContainerWidth - 20})
      .on('click', async () => {
        if (this.altNextCode) {
          this.altNextCode()
          return
        }
        this.tryNextCode('full');
      })
      .appendTo(this.machineDiv)
    this.compositionalButtons = $('<div>')
      .css({display: 'flex', justifyContent: 'space-between', 'width': this.dialContainerWidth, margin: 'auto'})
      .appendTo(this.machineDiv)
    for (let side of ['left', 'right']) {
      $("<button>")
        .addClass("code-button")
        .text("?")
        .on('click', () => {
          this.tryNextCode(side)
        })
        .css({ ...css, width: this.dialContainerWidth / 2 - 8})
        .appendTo(this.compositionalButtons)
    }
    if (this.nextCodeDelay) {
      await sleep(0)
      $('.code-button').on('click', async (e) => {
        $(e.currentTarget).css("background-color", NEXT_CODE_DISABLED_COLOR)
        this.lockInput()
        await sleep(this.nextCodeDelay)
        $(e.currentTarget).css("background-color", NEXT_CODE_COLOR)
        this.unlockInput()
      })
    }
  }

  getSolutionType(code) {
    let full = this.solutions[code]
    let result = full ? full :
      code.startsWith(this.leftSolution) ? "left" :
      code.endsWith(this.rightSolution) ? "right" :
      false
    return result
  }

  generateCode(side) {
    let code = this.getCode()
    console.log('generate', {side, code})
    if (side == 'left') {
      return randCode(this.maxDigit, this.leftSolution.length) + code.slice(this.rightSolution.length)
    } else if (side == 'right') {
      return code.slice(0, this.leftSolution.length) + randCode(this.maxDigit, this.rightSolution.length)
    } else {
      return randCode(this.maxDigit, this.codeLength)
    }
  }

  getNextCode(side) {
    // if we've hit the limit on pulls, reveal the solution
    let code
    for (let j = 0; j < 1000; j++) {
      code = this.generateCode(side)
      console.log({code})
      if (!this.triedCodes.has(code)) {
        return code
      }
    }
    assert(false, "getNextCode failed")
    // This really shouldn't happen
    this.logEvent("machine.getNextCode.failure")
    if (this.partialSolution) {
      return this.compositionalSolutions
    } else {
      return _.sample(Object.keys(this.solutions))
    }
  }
  
  tryNextCode(side) {
    this.lastAction = `nextCode.${side}`
    const code = this.getNextCode(side)
    this.setCode(code)
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

  async animateSolution(solutionType) {
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
    this.drawShape(this.animationCtx, this.blockString, this.partialSolution)

    // await sleep(500)
    // for (let i = 0; i < 2; i++) {
    //   drawSquare(0, 0, true)
    //   await sleep(150)
    //   drawSquare(0, 0, false)
    //   await sleep(150)
    // }
    // drawSquare(0, 0, true)

    // await sleep(1000)
    
    const delay = 50;
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
    this.logEvent(`machine.animationDone`)
  }

  async showSolution(solutionType, opts = {}) {
    this.lockInput()
    assert(solutionType, "invalid solutionType: " + solutionType)
    this.logEvent(`machine.solution.${solutionType}`)

    if (solutionType == "bespoke") {
      $(".dial-select").css('color', COLORS[3])
    } else {
      if (solutionType != "right") {
        $(".dial-select-left").css('color', COLORS[1])
      }
      if (solutionType != "left") {
        $(".dial-select-right").css('color', COLORS[2])
      }
    }

    if (opts.skipAnimation) {
      this.drawTarget(solutionType)
    } else {
      await this.animateSolution(solutionType)
    }
    this.partialSolution = solutionType

    if (solutionType == "compositional" || solutionType == "bespoke") {
      this.addSolutionToManual(solutionType)
      this.clearHandlers()
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
      this.unlockInput()
    }
  }

  lockInput() {
    $(".code-button")
      .prop("disabled", true)
    $(".dial-select").css('pointer-events', 'none')
    // this.nextCodeButton.prop('disabled', true)
    // this.nextCodeButton.css('background-color', NEXT_CODE_DISABLED_COLOR)
  }
  
  unlockInput() {
    $(".code-button")
      .css("pointer-events", "auto")
      .prop("disabled", false)
      .css("background-color", NEXT_CODE_COLOR)
    $(".dial-select").css('pointer-events', 'auto')
    if (this.partialSolution) {
      $(".dial-select-" + this.partialSolution).css('pointer-events', 'off')
    }
    // this.nextCodeButton.prop('disabled', false)
    // this.nextCodeButton.css('background-color', NEXT_CODE_COLOR)
  }

  clearHandlers() {
    // BROKEN: this doesn't seem to work
    $(document).off('.machine'); // Remove handlers from document
    this.div.off('.machine');    // Remove handlers from div elements
    this.logEvent('machine.handlers.cleared'); // Add this line
  }

  checkCode() {
    this.nTry += 1
    if (this.partialSolution) {
      this.nTryPartial += 1
    }

    let code = this.getCode()
    this.triedCodes.add(code)
    this.logEvent("machine.enter", { code, action: this.lastAction })

    let sol = this.getSolutionType(code)
    if (sol != this.partialSolution) {
      this.showSolution(sol)
    } else {
      if (this.nTry > this.maxTry || this.nTryPartial > this.maxTryPartial) {
        this.logEvent("machine.hitmax", { nTry: this.nTry, nTryPartial: this.nTryPartial })
        saveData()
        alert_info({html: "Try the green button!"})
      }
    }
}

  createManual() {
    // Create the manual div
    this.manualDiv = $("<div>")
      .addClass("manual-div")
      .css({
        width: this.contentWidth - this.machineWidth - 50 + "px",
      }).appendTo(this.div)

    const manualContainer = $("<div>").addClass("manual-container").css({
      border: "2px solid black",
      padding: "10px",
      "border-radius": "10px",
      "background-color": "white",
      height: "100%",
      "box-sizing": "border-box",
    })

    const title = $("<h3>").text("Shape Manual").css({
      "text-align": "left",
      "margin-bottom": "10px",
    })

    manualContainer.append(title)

    const examplesContainer = $("<div>").css({
      display: "flex",
      "justify-content": "flex-start",
      "flex-wrap": "wrap",
    })

    this.manual.forEach((example) => {
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

      assert(this.codeLength == 4, "codeLength is assumed to be 4 here")
      const colors = example.compositional ? [1, 1, 2, 2] : [3, 3, 3, 3]
      example.code.split("").forEach((digit, idx) => {
        const digitSpan = $("<span>")
          .text(digit)
          .css("color", COLORS[colors[idx]])
        codeText.append(digitSpan)
      })

      exampleDiv.append(canvas, codeText)
      examplesContainer.append(exampleDiv)
    })

    manualContainer.append(examplesContainer)
    this.manualDiv.append(manualContainer) // Append to manualDiv instead of div
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
