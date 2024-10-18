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

const COLORS = [
  'lightgray',
  '#FEBA49',
  '#CF3C22',
  '#119FBA',
]

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
  112
  _122
  11122
  _122
  112
`

class CodePuzzle {
  constructor(options = {}) {
    console.log('options', options);

    // Assign default values and override with any options provided
    _.assign(this, {
      solutions: {
        '1112': 'compositional',
        '1121': 'bespoke'
      },
      blockString: testBlock,  // default block
      dialSpeed: .02,  // speed of dial drag
      clickTime: 300,  // time threshold for a quick click
      maxDigit: 6,  // max digit allowed on each dial
      trialID: randomUUID(),  // unique trial ID
      screenWidth: 400,
      screenHeight: 300,
      blockSize: 40,
    }, options);

    window.cp = this;


    // this.correctCode = this.code.split('').map(Number); // convert code to array of digits
    this.codeLength = Object.keys(this.solutions)[0].length
    this.currentCode = Array(this.codeLength).fill(1); // default starting code, length based on codeLength
    this.div = $("<div>").addClass('puzzle-div').css({
      width: this.screenWidth + 200
    })
    this.done = make_promise(); // promise to resolve when the task is completed

    this.createScreen();
    this.createDials();
    this.logEvent('code.start');
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
    this.logEvent('code.run');
    if (display) this.attach(display); // attach the display if provided
    await make_promise();
    await this.done; // wait until the puzzle is completed
  }

  createScreen() {
    // padding
    $('<div>').css({
      height: 20
    }).appendTo(this.div)
    // Create the screen for the shape (canvas element)
    this.screen = $('<canvas></canvas>').attr({
      width: this.screenWidth,
      height: this.screenHeight
    }).css({
      'border': '3px solid black',
      'margin': '10px auto',
      'margin-top': '20px',
      'display': 'block',
      'border-radius': '10px',
      'background-color': 'white',
    });
    // padding

    this.div.append(this.screen); // Append the canvas to the main div

    // Initialize the canvas context (this.ctx)
    this.ctx = this.screen[0].getContext('2d');

    // Initial drawing of the shape in gray
    this.drawShape(false);
  }

  drawShape(solution) {
    console.log('drawShape', solution)
    // Clear the screen (canvas context)
    this.ctx.clearRect(0, 0, this.screenWidth, this.screenHeight);

    if (solution == 'compositional') {
      let blocks = string2blockSplit(this.blockString, 1, 1)
      window.blocks = blocks
      for (const b of blocks) {
        b.draw(this.ctx, this.blockSize);
      }
    } else {
      let color = solution == 'bespoke' ? 3 : 0
      console.log('color', color)
      let block = string2block(this.blockString, 1, 1, color)
      window.block = block
      // block.x = (this.screenWidth / this.blockSize - block.width) / 2
      // block.y = (this.screenHeight / this.blockSize - block.height) / 2
      block.draw(this.ctx, this.blockSize);
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
      let dialWrapper = $('<div></div>').css(dialStyle).data('index', i);
      let numberElement = $('<div></div>').addClass('dial-number').text(this.currentCode[i]);
      this.numberEls.push(numberElement); // Store each number element in the array for later updates

      dialWrapper.append(numberElement);

      let isDragging = false;
      let startY = 0;
      let currentNumber = this.currentCode[i];
      let mouseDownTime = 0;

      // Attach mousedown handler (namespaced for this trial)
      dialWrapper.on('mousedown.machine', (event) => {
        if (this.solved) return  // HACK to fix clearHandlers not working
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

    this.div.append(dialContainer); // append the dial container to the main div
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

  async showSolution(solution) {
    this.drawShape(solution); // Draw blue shape on success
    let colors = solution == 'compositional' ? [1, 1, 2, 2] : [3, 3, 3, 3]
    this.numberEls.forEach((el, idx) => {
      console.log('colors[idx]', colors[idx])
      el.css('color', COLORS[colors[idx]])
    })
    this.solved = true
    this.clearHandlers()

    await make_promise()
    this.done.resolve(); // Mark the puzzle as complete
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
      this.logEvent('correct_code_entered', { code: this.currentCode.join('') });
      this.showSolution(this.solutions[input])
    } else {
      this.drawShape(false); // Keep the shape gray if incorrect
      this.logEvent('incorrect_code_entered', { code: this.currentCode.join('') });
    }
  }
}
