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
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1 + (grid / 30);
      ctx.strokeRect(partX, partY, grid, grid);
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
        if (v == "X") {
          parts.push({x, y})
        }
      })
    })
    return new Block({x, y, parts, color, id})
}



class CodePuzzle {
  constructor(options = {}) {
    console.log('options', options);

    // Assign default values and override with any options provided
    _.assign(this, {
      code: '1344',                // default correct code
      blockString: 'XXX\nXX\nXXX', // default block
      dialSpeed: .02,              // speed of dial drag
      clickTime: 300,              // time threshold for a quick click
      maxDigit: 6,                 // max digit allowed on each dial
      trialID: randomUUID(),       // unique trial ID
      screenWidth: 300,
      screenHeight: 200,
      blockSize: 40,
    }, options);

    window.cp = this;

    this.correctCode = this.code.split('').map(Number); // convert code to array of digits
    this.codeLength = this.correctCode.length
    this.currentCode = Array(this.codeLength).fill(1); // default starting code, length based on codeLength
    this.div = $("<div>").addClass('puzzle-div').css({
      width: this.screenWidth + 200
    })
    this.done = make_promise(); // promise to resolve when the task is completed

    this.createScreen();
    this.createDials();
    this.logEvent('code.start', { code: this.correctCode.join('') });
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

  drawShape(success) {
      // Clear the screen (canvas context)
      this.ctx.clearRect(0, 0, this.screenWidth, this.screenHeight);

      // Set the color based on success (blue for correct, light gray for incorrect)
      let shapeColor = success ? 'blue' : 'lightgray';

      // // Define the parts of the shape (relative coordinates)
      // const parts = [
      //   {x: 1, y: 1}, {x: 2, y: 1}, {x: 3, y: 1},
      //   {x: 1, y: 2}, {x: 2, y: 2}, {x: 3, y: 2},
      //   {x: 1, y: 3}, {x: 2, y: 3}, {x: 3, y: 3}
      // ];

      // // Create the Block object, using the parts and the color determined above
      // const block = new Block({
      //   x: 0, // Position of the block (top-left corner)
      //   y: 0,
      //   parts: parts, // The shape parts
      //   color: shapeColor, // Color based on success/failure
      //   id: "shape" // Optional ID for identification
      // });
      let block = string2block(this.blockString, 1, 1, shapeColor)
      window.block = block
      block.x = (this.screenWidth / this.blockSize - block.width) / 2
      block.y = (this.screenHeight / this.blockSize - block.height) / 2

      console.log(block)


      // Call the draw method of Block, using the canvas context and grid size
      block.draw(this.ctx, this.blockSize); // 40px grid size to fit within 200x200 canvas
  }

  createDials(speedFactor = 50) {
    // Calculate appropriate width for the entire container based on codeLength
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
      'background': 'white'
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

    let numberEls = []

    for (let i = 0; i < this.codeLength; i++) {
      let dialWrapper = $('<div></div>').css(dialStyle).data('index', i);
      let numberElement = $('<div></div>').addClass('dial-number').text(this.currentCode[i]);
      numberEls.push(numberElement)

      dialWrapper.append(numberElement);

      let isDragging = false;
      let startY = 0;
      let currentNumber = this.currentCode[i];
      let mouseDownTime = 0;

      dialWrapper.on('mousedown', (event) => {
        isDragging = false;
        startY = event.pageY;
        mouseDownTime = Date.now(); // Record the mousedown time

        // Define the dragHandler and mouseUpHandler inside mousedown to ensure clean scope
        const dragHandler = (event) => {
          let deltaY = event.pageY - startY;
          if (Math.abs(deltaY) > 5) { // Only trigger dragging if there's significant movement
            isDragging = true;
          }

          if (isDragging) {
            let change = Math.round(deltaY * this.dialSpeed); // Control how fast the numbers change

            // Update the number dynamically as you drag, keeping it between 1 and maxDigit
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
            // numberElement.text(currentNumber);
            this.currentCode[i] = currentNumber;
            // this.checkCode();
          }

          // Update the display for each dial
          for (let j = 0; j < this.codeLength; j++) {
            numberEls[j].text(this.currentCode[j]);
          }

          // Check the code after the change
          this.checkCode();

          // Clean up the event handlers after the mouse is released
          $(document).off('mousemove', dragHandler);
          $(document).off('mouseup', mouseUpHandler);
        };

        // Attach the event handlers
        $(document).on('mousemove', dragHandler);
        $(document).on('mouseup', mouseUpHandler);
      });

      dialContainer.css({marginBottom: 50})
      dialContainer.append(dialWrapper);

      // Add separator line between dials (except the last one)
      if (i < this.codeLength - 1) {
        dialContainer.append($('<div></div>').css({
          'height': '30px',         // Shorter height for the separator
          'width': '1px',
          'background-color': 'gray',
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

  checkCode() {
    // Compare the current code with the correct code
    let isCorrect = this.currentCode.every((val, index) => val === this.correctCode[index]);

    if (isCorrect) {
      this.drawShape(true); // Draw blue shape on success
      this.logEvent('correct_code_entered', { code: this.currentCode.join('') });
      this.done.resolve(); // Mark the puzzle as complete
    } else {
      this.drawShape(false); // Keep the shape gray if incorrect
      this.logEvent('incorrect_code_entered', { code: this.currentCode.join('') });
    }
  }
}
