const COLORS = [
  'lightgray',
  '#548df0',
  '#e96060',
  '#b46cc6',
]

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
    console.log('options', options);

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
        dialSpeed: 0.02, // speed of dial drag
        clickTime: 300, // time threshold for a quick click
        maxDigit: 6, // max digit allowed on each dial
        trialID: randomUUID(), // unique trial ID
        blockSize: 40,
        width: 7, // Width in block units, not including padding
        height: 5, // Height in block units, not including padding
        manualScale: 0.25,
        drawingMode: false,
        machineColor: "#656565",
        suppressSuccess: false,
      },
      options
    )
    if (this.drawingMode) {
      this.width = 30
      this.height = 30
      this.blockSize = 30
    }

    this.logEvent('machine.initialize', _.pick(this, ['task', 'solutions', 'blockString']))
    // Calculate screen dimensions based on blockSize, width, and height
    this.screenWidth = (this.width + 2) * this.blockSize; // +2 for padding
    this.screenHeight = (this.height + 2) * this.blockSize; // +2 for padding

    window.cp = this;

    this.codeLength = Object.keys(this.solutions)[0].length
    this.currentCode = Array(this.codeLength).fill(1); // default starting code, length based on codeLength

    // Create the top-level div
    this.div = $("<div>").addClass('puzzle-container').css({
      display: 'flex',
      justifyContent: 'space-between',
      width: '100%',
      maxWidth: '1200px', // Adjust as needed
      margin: '0 auto'
    });

    // Calculate the machine width based on screenWidth
    const machineWidth = this.screenWidth + 100;

    // Create the machine div
    this.machineDiv = $("<div>").addClass('machine-div').css({
      width: machineWidth + 'px',
      paddingLeft: this.blockSize + 'px',
      paddingRight: this.blockSize + 'px', // Add padding on both left and right
      backgroundColor: this.machineColor,
    })

    // Create the manual div
    this.manualDiv = $("<div>").addClass('manual-div').css({
      width: 'calc(100% - ' + (machineWidth + 50) + 'px)' // Adjust for spacing
    });

    // Append machine and manual divs to the main div
    this.div.append(this.machineDiv, this.manualDiv);

    this.done = make_promise(); // promise to resolve when the task is completed

    this.createScreen();
    if (this.drawingMode) {
      this.createDrawingInterface(); // Add this line
    } else {
      this.createDials();
      this.createManual();
    }
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
    this.drawTarget()
    // this.showSolution('compositional')
    // await make_promise()
    await this.done; // wait until the puzzle is completed
    this.logEvent('machine.done')
  }

  createScreen() {
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

    // Initialize the canvas context (this.ctx)
    this.ctx = this.screen[0].getContext('2d');
  }

  drawTarget(mode='target') {
    console.log("👉 drawTarget", mode)
    this.drawShape(this.ctx, this.blockString, mode);
  }

  drawShape(ctx, blockString, mode, manual=false) {
    console.log('drawShape', mode)
    let blockSize = manual ? this.blockSize * this.manualScale : this.blockSize
    
    // Clear the screen (canvas context)
    ctx.clearRect(0, 0, this.screenWidth, this.screenHeight);

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

  createDials(speedFactor = 50) {
    let dialWidth = 60; // Base width per dial
    let containerWidth = this.codeLength * dialWidth;

    let dialContainer = $('<div></div>').css({
      'display': 'flex',
      'justify-content': 'space-between',    // Evenly space the dials
      'align-items': 'center',               // Vertically center the dials
      'margin-top': '20px',
      'border-radius': '10px',
      'border': '3px solid black',
      'padding': '10px',
      'width': `${containerWidth}px`,        // Scale total width of the container by codeLength
      'height': '60px',
      'position': 'relative',
      'margin-left': 'auto',
      'margin-right': 'auto',
      'overflow': 'hidden',
      'background': 'white',
      'margin-bottom': '50px'                // Moved outside loop
    });

    let dialStyle = {
      'flex': '1',
      'text-align': 'center',
      'font-size': `${40 - this.codeLength * 2}px`, // Scale font size based on codeLength
      'font-weight': 'bold',
      'line-height': '40px',                       // Vertical alignment of numbers
      'cursor': 'pointer',
      'user-select': 'none',
      'position': 'relative',
      'height': '100%',
      'display': 'flex',
      'align-items': 'center',                     // Vertically center the number in each dial
      'justify-content': 'center',                 // Horizontally center the number in each dial
      'width': 'auto'                              // Let the flexbox handle the width
    };

    this.numberEls = []; // Store number elements for updating later

    for (let i = 0; i < this.codeLength; i++) {
      let dialWrapper = $('<div></div>').addClass('dial').attr('id', `dial-${i}`).css(dialStyle).data('index', i);
      let numberElement = $('<div></div>').addClass('dial-number').text(this.currentCode[i]);

      this.numberEls.push(numberElement); // Store each number element in the array for later updates

      dialWrapper.append(numberElement);

      let isDragging = false;
      let startY = 0;
      let currentNumber = this.currentCode[i];
      let mouseDownTime = 0;

      // Attach mousedown handler (namespaced for this trial)
      dialWrapper.on('mousedown.machine', (event) => {
        if (this.dialsDisabled) return  // HACK to fix clearHandlers not working
        isDragging = false;
        startY = event.pageY;
        mouseDownTime = Date.now(); // Record the mousedown time

        const dragHandler = (event) => {
          let deltaY = event.pageY - startY;
          if (Math.abs(deltaY) > 5) { // Only trigger dragging if there's significant movement
            isDragging = true;
          }

          if (isDragging) {
            let change = Math.round(deltaY * this.dialSpeed); // Control how fast the numbers change
            currentNumber = ((this.currentCode[i] - change - 1 + this.maxDigit) % this.maxDigit + this.maxDigit) % this.maxDigit + 1;
            numberElement.text(currentNumber);
          }
        };

        const mouseUpHandler = (event) => {
          let mouseUpTime = Date.now(); // Record the mouseup time

          // If the click is quick and no drag occurred
          if (mouseUpTime - mouseDownTime < this.clickTime && Math.abs(event.pageY - startY) < 5) {
            // Use the incrementDial function to handle the increment logic
            this.incrementDial(i);

          } else {
            // Ensure currentNumber stays between 1 and maxDigit after dragging
            currentNumber = ((Math.round(currentNumber) - 1) % this.maxDigit + this.maxDigit) % this.maxDigit + 1;
            this.currentCode[i] = currentNumber;
          }

          // Update the display for each dial
          for (let j = 0; j < this.codeLength; j++) {
            this.numberEls[j].text(this.currentCode[j]);
          }

          // Check the code after the change
          this.checkCode();

          // Clean up the event handlers after the mouse is released
          $(document).off('mousemove.machine', dragHandler);
          $(document).off('mouseup.machine', mouseUpHandler);
        };

        // Attach the event handlers
        $(document).on('mousemove.machine', dragHandler);
        $(document).on('mouseup.machine', mouseUpHandler);
      });

      dialContainer.append(dialWrapper);

      // Add separator line between dials (except the last one)
      if (i < this.codeLength - 1) {
        dialContainer.append($('<div></div>').css({
          'height': '30px',         // Shorter height for the separator
          'width': '2px',
          'background-color': 'lightgray',
          'margin': '0 5px',        // Horizontal margin for spacing
          'align-self': 'center'    // Vertically center the line
        }));
      }
    }

    this.machineDiv.append(dialContainer); // Append to machineDiv instead of div
  }


  incrementDial(position) {
    // Increment the number at the current position
    this.currentCode[position] = (this.currentCode[position] % this.maxDigit) + 1;  // Use maxDigit

    // Check if carrying is needed (i.e., if we incremented from maxDigit to 1)
    if (this.currentCode[position] === 1 && position > 0) {
      // Recursively apply the carrying step to the number to the left
      this.incrementDial(position - 1);
    }
  }


  updateManual(solutionType) {
    // Check if this entry already exists in the manual
    const existingEntry = this.manual.find(entry => 
      entry.task === this.task &&
      entry.blockString === this.blockString &&
      entry.compositional === (solutionType === 'compositional') &&
      entry.code === this.currentCode.join('')
    );

    // If the entry doesn't exist, add it to the manual
    if (!existingEntry) {
    this.manual.push({
      task: this.task,
      blockString: this.blockString,
      compositional: solutionType == 'compositional',
      code: this.currentCode.join(''),
      })
    }
  }

  async showSolution(solutionType) {
    this.logEvent("machine.solved", {solutionType})
    this.updateManual(solutionType)
    this.drawTarget(solutionType); // Draw blue shape on success
    let colors = solutionType == 'compositional' ? [1, 1, 2, 2] : [3, 3, 3, 3]
    this.numberEls.forEach((el, idx) => {
      el.css('color', COLORS[colors[idx]])
    })
    this.dialsDisabled = true
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
  }

  checkCode() {
    // Compare the current code with the correct code
    let input = this.currentCode.join('')
    if (this.solutions[input]) {
      this.logEvent('machine.enter.correct', { code: this.currentCode.join('') });
      this.showSolution(this.solutions[input])
    } else {
      // this.drawShape(this.ctx, this.blockString, 'gray'); // Keep the shape gray if incorrect
      this.logEvent('machine.enter.incorrect', { code: this.currentCode.join('') });
    }
  }

  
  createManual() {
    const manualContainer = $('<div>').addClass('manual-container').css({
      'border': '2px solid black',
      'padding': '10px',
      'border-radius': '10px',
      'background-color': 'white',
      'height': '100%',
      'box-sizing': 'border-box'
    });

    const title = $('<h3>').text('Shape Manual').css({
      'text-align': 'center',
      'margin-bottom': '10px'
    });

    manualContainer.append(title);

    const examplesContainer = $('<div>').css({
      'display': 'flex',
      'justify-content': 'space-around',
      'flex-wrap': 'wrap'
    });

    this.manual.forEach(example => {
      const exampleDiv = $('<div>').css({
        'text-align': 'center',
        'margin': '10px'
      });

      const canvas = $('<canvas>').attr({
        width: this.screenWidth * this.manualScale,
        height: this.screenHeight * this.manualScale
      })

      const ctx = canvas[0].getContext('2d');
      this.drawShape(ctx, example.blockString, example.compositional ? 'compositional' : 'bespoke', true);

      const codeText = $('<p>').css({
        'margin-top': '5px',
        'display': 'flex',
        'justify-content': 'center',
        'align-items': 'center',
        'font-weight': 'bold',
        'font-size': '30px'
      });
      
      const colors = example.compositional ? [1, 1, 2, 2] : [3, 3, 3, 3];
      example.code.split('').forEach((digit, idx) => {
        const digitSpan = $('<span>')
          .text(digit)
          .css('color', COLORS[colors[idx]]);
        codeText.append(digitSpan);
      });

      exampleDiv.append(canvas, codeText);
      examplesContainer.append(exampleDiv);
    });

    manualContainer.append(examplesContainer);
    this.manualDiv.append(manualContainer); // Append to manualDiv instead of div
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
      .click(() => this.copyGridAsString());

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
  }

  setPasteMode() {
    if (this.copiedShape) {
      this.mode = 'paste';
    } else {
      alert('No shape copied yet!');
    }
  }

  startDrawing(e) {
    const { x, y } = this.getGridCoordinates(e);
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      if (this.mode === 'draw') {
        this.isDrawing = true;
        this.isErasing = this.grid[y][x] !== 0;
        this.draw(e);
      } else if (this.mode === 'copy') {
        this.copyShape(x, y);
      } else if (this.mode === 'paste') {
        this.pasteShape(x, y);
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



