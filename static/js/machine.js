const COLORS = [
  'lightgray',
  '#548df0',
  '#e96060',
  '#b46cc6',
]

const NEXT_CODE_COLOR = "#4abf41"
const NEXT_CODE_DISABLED_COLOR = "#94c490"
class Block {
  constructor({x, y, parts, color, id} = {}) {
    this.x = x;
    this.y = y;
    this.parts = parts; // Array of {x, y} parts relative to the block's position
    this.color = color;
    this.id = id
    this.colliding = false;
    this.rotation = 0  // just for analysis convenience
    this.width = _(this.parts).map((part) => part.x).max() + 1
    this.height = _(this.parts).map((part) => part.y).max() + 1
  }

  draw(ctx, grid) {
    // Draw individual parts with a thin outline
    ctx.fillStyle = this.colliding ? `rgba(${hex2rgb(this.color)},0.2)` : this.color; // Set transparency on collision
    this.parts.forEach(part => {
      const partX = (this.x + part.x) * grid;
      const partY = (this.y + part.y) * grid;
      ctx.fillRect(partX, partY, grid, grid);
      // light border on each tile
      // ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      // ctx.lineWidth = 1 + (grid / 30);
      // ctx.strokeRect(partX, partY, grid, grid);
    });

    // Now, draw the thick border around the shape
    ctx.strokeStyle = this.colliding ? 'rgba(0,0,0,0.2)' : 'black';
    ctx.lineWidth = 1 + (grid / 30);
    // Helper function to check if there is an adjacent part
    const hasAdjacentPart = (dx, dy) => {
      return this.parts.some(part => part.x === dx && part.y === dy);
    };

    this.parts.forEach(part => {
      const partX = (this.x + part.x) * grid;
      const partY = (this.y + part.y) * grid;

      // For each side of the part, draw a line if there is no adjacent part
      if (!hasAdjacentPart(part.x, part.y - 1)) {
        // No part above, draw top line
        ctx.beginPath();
        ctx.moveTo(partX, partY);
        ctx.lineTo(partX + grid, partY);
        ctx.stroke();
      }
      if (!hasAdjacentPart(part.x + 1, part.y)) {
        // No part to the right, draw right line
        ctx.beginPath();
        ctx.moveTo(partX + grid, partY);
        ctx.lineTo(partX + grid, partY + grid);
        ctx.stroke();
      }
      if (!hasAdjacentPart(part.x, part.y + 1)) {
        // No part below, draw bottom line
        ctx.beginPath();
        ctx.moveTo(partX, partY + grid);
        ctx.lineTo(partX + grid, partY + grid);
        ctx.stroke();
      }
      if (!hasAdjacentPart(part.x - 1, part.y)) {
        // No part to the left, draw left line
        ctx.beginPath();
        ctx.moveTo(partX, partY);
        ctx.lineTo(partX, partY + grid);
        ctx.stroke();
      }
    });
  }
}

function string2block(s, x, y, color, id='block') {
    if (s == 'blank') {
      s = BLANK
    }
    if (typeof(color) == 'number') {
      color = COLORS[color]
    }
    let rows = s.trim().split('\n')
    let parts = []
    rows.forEach((row, y) => {
      row.trim().split('').forEach((v, x) => {
        if (v != "_" && v != " ") {
          parts.push({x, y})
        }
      })
    })
    return new Block({x, y, parts, color, id})
}

function string2blockSplit(s, x, y) {
    let rows = s.trim().split('\n')
    let parts = {}
    rows.forEach((row, y) => {
      row.trim().split('').forEach((v, x) => {
        if (v != "_" && v != " ") {
          if (parts[v] === undefined) {
            parts[v] = []
          }
          parts[v].push({x, y})
        }
      })
    })
    return Object.entries(parts).map(([v, bparts]) => new Block({x, y, parts: bparts, color: COLORS[v]}));
}

const testBlock = `
11___22
_11222_
__112__
_11222_
11___22
`

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
        width: 7, // Width in block units, not including padding
        height: 5, // Height in block units, not including padding
        manualScale: 0.25,
        initialCode: "random",
        drawingMode: false,
        machineColor: "#707374",
        allowClicks: false,
        suppressSuccess: false,
        showNextCodeButton: true,
        showLocks: true,
        showManual: true,
        codeLength: 4,
        contentWidth: 1200,
      },
      options
    )
    window.cp = this;
    if (this.drawingMode) {
      this.width = 30
      this.height = 30
      this.blockSize = 30
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
    
    if (this.drawingMode) {
      this.createDrawingInterface();
      return
    }
    
    this.dialLocked = Array(this.codeLength).fill(false)
    this.nTry = 0
    if (this.initialCode == 'random') {
      // Generate a random starting code that's not in solutions
      do {
        this.currentCode = Array(this.codeLength).fill().map(() => Math.floor(Math.random() * this.maxDigit) + 1);
      } while (this.solutions[this.currentCode.join('')]);
    } else {
      this.currentCode = this.initialCode.split('').map(Number);
    }
    
    this.logEvent('machine.initialize', _.pick(this, ['task', 'currentCode', 'solutions', 'blockString', 'manual']))
    this.done = make_promise(); // promise to resolve when the task is completed

    this.createDials();
    this.drawTarget()
    if (this.showNextCodeButton) this.createNextCodeButton()
    if (this.showLocks) this.createLocks()
    if (this.showManual) this.createManual()
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
        height: this.screenHeight + 200 + "px",
        paddingLeft: this.blockSize + "px",
        paddingRight: this.blockSize + "px",
        backgroundColor: this.machineColor,
      }).appendTo(this.div)

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
    }).appendTo(this.machineDiv)  

    this.ctx = this.screen[0].getContext('2d');
  }

  drawTarget(mode='target') {
    this.drawShape(this.ctx, this.blockString, mode);
  }

  drawShape(ctx, blockString, mode, manual=false) {
    let blockSize = manual ? this.blockSize * this.manualScale : this.blockSize
    
    // Clear the screen (canvas context)
    ctx.clearRect(0, 0, this.screenWidth, this.screenHeight);
    if (mode == 'blank') return

    if (mode == 'compositional') {
      let blocks = string2blockSplit(blockString, 1, 1)
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

        let select = $('<select></select>').css({
            'font-size': `${40 - this.codeLength * 2}px`,
            'font-weight': 'bold',
            'border': 'none',
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

        select.val(this.currentCode[i]);

        select.on('change', () => {
            this.currentCode[i] = parseInt(select.val());
            console.log('currentCode', this.currentCode)
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
    this.checkCode()
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

  createNextCodeButton() {
    const nextCodeButton = $('<button>')
      .text('?')
      .css({
        'color': 'white',
        'font-weight': 'bold',
        'background-color': NEXT_CODE_COLOR,
        // 'transition': 'background-color 0.02s ease',
        'outline': 'none',
        'cursor': 'pointer',
        'border': '3px solid black',
        'border-radius': '10px',
        'position': 'absolute',
        'right': '50px',  // Adjust this value as needed to position the button correctly
        'top': this.blockSize + this.screenHeight + 35,
        'padding': '0px 8px',
        'font-size': '25px',
        'cursor': 'pointer'
      })
      .on('click', async () => {
        this.tryNextCode();
        if (this.nextCodeDelay) {
          nextCodeButton.prop('disabled', true)
          nextCodeButton.css('background-color', NEXT_CODE_DISABLED_COLOR)
          await sleep(this.nextCodeDelay)
          nextCodeButton.prop('disabled', false)
          nextCodeButton.css('background-color', NEXT_CODE_COLOR)
        }
      });

    this.machineDiv.append(nextCodeButton);
  }

  
  tryNextCode() {
    this.logEvent("nosave.machine.nextCode")
    this.lastAction = "nextCode"
    if (this.nextCodeDisabled) return // HACK to fix clearHandlers not working
    let incrementDial = (position) => {
      if (position < 0) return
      if (this.dialLocked[position]) return incrementDial(position - 1)
      // Increment the number at the current position
      this.currentCode[position] =
        (this.currentCode[position] % this.maxDigit) + 1

      // Check if carrying is needed (i.e., if we incremented from maxDigit to 1)
      if (this.currentCode[position] === 1) {
        // Recursively apply the carrying step to the number to the left
        incrementDial(position - 1)
      }
    }
    incrementDial(this.codeLength - 1)
    // update display
    for (let j = 0; j < this.codeLength; j++) {
      this.numberEls[j].val(this.currentCode[j])
    }
    this.checkCode()
  }


  addSolutionToManual(entry) {
    if (typeof entry == 'string') {
      entry = {
        task: this.task,
        blockString: this.blockString,
        compositional: entry == "compositional",
        code: this.currentCode.join(""),
      }
    }

    if (typeof entry.blockString !== 'string' || entry.blockString.trim() === '') {
      console.error('Invalid entry: blockString must be a non-empty string');
      return;
    }

    // Check if this entry already exists in the manual
    const existingEntry = this.manual.find(e2 => 
      e2.task === entry.task &&
      e2.blockString === entry.blockString &&
      e2.compositional === entry.compositional &&
      e2.code === entry.code
    );
    
    // If the entry doesn't exist, add it to the manual
    if (!existingEntry) {
      this.manual.push(entry)
      this.logEvent('machine.manual.update', entry);
    }
  }

  async showSolution(solutionType) {
    this.logEvent("machine.solved", {solutionType})
    this.addSolutionToManual(solutionType)
    this.drawTarget(solutionType); // Draw blue shape on success
    let colors = solutionType == 'compositional' ? [1, 1, 2, 2] : [3, 3, 3, 3]
    this.numberEls.forEach((el, idx) => {
      el.css('color', COLORS[colors[idx]])
    })
    this.dialsDisabled = true
    this.nextCodeDisabled = true
    this.clearHandlers()
    // checkmark on goal
    $("<p>")
      .html("&#x2713")
      .css({
        position: "absolute",
        fontSize: 200,
        top: -140,
        // marginTop: -200,
        zIndex: 5,
      })
      .appendTo(this.goalBox)

    // party parrot
    $("<img>", { src: "static/img/parrot.gif" })
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
  }

  clearHandlers() {
    // BROKEN: this doesn't seem to work
    $(document).off('.machine'); // Remove handlers from document
    this.div.off('.machine');    // Remove handlers from div elements
    this.logEvent('machine.handlers.cleared'); // Add this line
  }

  checkCode() {
    // Update the display for each dial
    this.nTry += 1
    // Compare the current code with the correct code
    let input = this.currentCode.join("")
    let info = { code: input, action: this.lastAction }
    if (this.solutions[input]) {
      this.logEvent("machine.enter.correct", info)
      this.showSolution(this.solutions[input])
    } else {
      // this.drawShape(this.ctx, this.blockString, 'gray'); // Keep the shape gray if incorrect
      this.logEvent("machine.enter.incorrect", info)
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

  createDrawingInterface() {
    this.copiedShape = null;
    this.drawingColor = 1; // Default color index
    this.isDrawing = false;
    this.isErasing = false;
    this.grid = Array(this.height).fill().map(() => Array(this.width).fill(0));

    // Add color selection buttons
    const colorSelector = $('<div>').css({
      'display': 'flex',
      'justify-content': 'center',
      'margin-bottom': '10px'
    });

    COLORS.forEach((color, index) => {
      if (index === 0) return; // Skip the first color (lightgray)
      const button = $('<button>')
        .text(index)
        .css({
          'background-color': color,
          'width': '30px',
          'height': '30px',
          'margin': '0 5px',
          'border': 'none',
          'border-radius': '50%',
          'cursor': 'pointer'
        })
        .click(() => {
          this.drawingColor = index;
        });
      colorSelector.append(button);
    });

    // Add copy button
    const copyButton = $('<button>')
      .text('Copy')
      .css({
        'margin-left': '10px'
      })
      .click(() => {
        this.copyGridAsString();
        this.logEvent('machine.drawing.copy'); // Add this line
      });

    colorSelector.append(copyButton);

    this.machineDiv.prepend(colorSelector);

    // Add copy/paste buttons
    // const copyPasteButtons = $('<div>').css({
    //   'display': 'flex',
    //   'justify-content': 'center',
    //   'margin-bottom': '10px'
    // });

    // const copyButton = $('<button>').text('Copy (X)').click(() => this.setCopyMode());
    // const pasteButton = $('<button>').text('Paste (V)').click(() => this.setPasteMode());

    // copyPasteButtons.append(copyButton, pasteButton);
    // this.machineDiv.prepend(copyPasteButtons);

    // Modify existing keydown event listener
    $(document).on('keydown.drawing', (e) => {
      if (e.key >= '1' && e.key <= '4') {
        this.drawingColor = parseInt(e.key);
      } else if (e.key.toLowerCase() === 'c') {
        this.copyGridAsString();
      } else if (e.key.toLowerCase() === 'x') {
        this.setCopyMode();
      } else if (e.key.toLowerCase() === 'v') {
        this.setPasteMode();
      }
    });

    this.mode = 'draw'; // 'draw', 'copy', or 'paste'

    // Set up event listeners
    this.screen.on('mousedown.drawing', (e) => this.startDrawing(e));
    this.screen.on('mousemove.drawing', (e) => this.draw(e));
    this.screen.on('mouseup.drawing', () => this.stopDrawing());
    this.screen.on('mouseleave.drawing', () => this.stopDrawing());

    this.redrawGrid(); // Add this line to draw the initial grid
  }

  setCopyMode() {
    this.mode = 'copy';
    this.logEvent('machine.drawing.mode', { mode: 'copy' }); // Add this line
  }

  setPasteMode() {
    if (this.copiedShape) {
      this.mode = 'paste';
      this.logEvent('machine.drawing.mode', { mode: 'paste' }); // Add this line
    } else {
      alert('No shape copied yet!');
      this.logEvent('machine.drawing.paste.error', { error: 'No shape copied' }); // Add this line
    }
  }

  startDrawing(e) {
    const { x, y } = this.getGridCoordinates(e);
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      if (this.mode === 'draw') {
        this.isDrawing = true;
        this.isErasing = this.grid[y][x] !== 0;
        this.draw(e);
        this.logEvent('machine.drawing.start', { mode: 'draw', x, y, isErasing: this.isErasing }); // Add this line
      } else if (this.mode === 'copy') {
        this.copyShape(x, y);
        this.logEvent('machine.drawing.start', { mode: 'copy', x, y }); // Add this line
      } else if (this.mode === 'paste') {
        this.pasteShape(x, y);
        this.logEvent('machine.drawing.start', { mode: 'paste', x, y }); // Add this line
      }
    }
  }

  stopDrawing() {
    this.isDrawing = false;
    this.isErasing = false;
  }

  draw(e) {
    if (!this.isDrawing) return;

    const { x, y } = this.getGridCoordinates(e);

    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      if (this.isErasing) {
        this.grid[y][x] = 0;
      } else {
        this.grid[y][x] = this.drawingColor;
      }
      this.redrawGrid();
    }
  }

  getGridCoordinates(e) {
    const rect = this.screen[0].getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / this.blockSize) - 1;
    const y = Math.floor((e.clientY - rect.top) / this.blockSize) - 1;
    return { x, y };
  }

  redrawGrid() {
    this.ctx.clearRect(0, 0, this.screenWidth, this.screenHeight);

    // Draw grid lines
    this.ctx.strokeStyle = 'lightgray';
    this.ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= this.width; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo((x + 1) * this.blockSize, this.blockSize);
      this.ctx.lineTo((x + 1) * this.blockSize, (this.height + 1) * this.blockSize);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= this.height; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.blockSize, (y + 1) * this.blockSize);
      this.ctx.lineTo((this.width + 1) * this.blockSize, (y + 1) * this.blockSize);
      this.ctx.stroke();
    }

    // Draw colored blocks
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] !== 0) {
          this.ctx.fillStyle = COLORS[this.grid[y][x]];
          this.ctx.fillRect((x + 1) * this.blockSize, (y + 1) * this.blockSize, this.blockSize, this.blockSize);
        }
      }
    }
  }

  copyGridAsString() {
    let result = '';
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        result += this.grid[y][x] === 0 ? '_' : this.grid[y][x];
      }
      result += '\n';
    }
    console.log(result.trim()); // Output to console
    navigator.clipboard.writeText(result.trim())
  }

  copyShape(startX, startY) {
    const color = this.grid[startY][startX];
    if (color === 0) {
      alert('Cannot copy empty space!');
      return;
    }

    const visited = new Set();
    const shape = [];
    let minX = startX, minY = startY;

    const dfs = (x, y) => {
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
      const key = `${x},${y}`;
      if (visited.has(key) || this.grid[y][x] !== color) return;

      visited.add(key);
      shape.push({x: x - startX, y: y - startY});
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);

      dfs(x+1, y);
      dfs(x-1, y);
      dfs(x, y+1);
      dfs(x, y-1);
    };

    dfs(startX, startY);

    // Normalize shape to top-left corner
    this.copiedShape = {
      color: color,
      parts: shape.map(part => ({x: part.x - (minX - startX), y: part.y - (minY - startY)}))
    };

    this.mode = 'paste';
  }

  pasteShape(x, y) {
    if (!this.copiedShape) return;

    this.copiedShape.parts.forEach(part => {
      const newX = x + part.x;
      const newY = y + part.y;
      if (newX >= 0 && newX < this.width && newY >= 0 && newY < this.height) {
        this.grid[newY][newX] = this.copiedShape.color;
      }
    });

    this.redrawGrid();
    this.mode = 'draw'; // Reset to draw mode after pasting
  }
}
