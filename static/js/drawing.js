class DrawingInterface {
  constructor(options = {}) {
    const defaults = {
      width: 8,
      height: 5,
      blockSize: 20,
      numScreens: 4,
      containerWidth: 1500,
      extraScreens: 0,
      storageKey: 'default'
    }
    window.D = this

    this.options = _.defaults(options, defaults)
    Object.assign(this, this.options)

    this.div = $("<div>")
      .addClass("drawing-container")
      .css({
        width: this.containerWidth + "px",
        margin: "0 auto",
      })

    const state = localStorage.getItem(this.storageKey)
    if (state) {
      try {
        this.loadState(state)
      } catch (e) {
        console.error("Failed to load state", e)
        localStorage.removeItem(this.storageKey)
      }
    }
    if (!this.screenMatrix) {
      this.initialize()
    }
  }

  initialize() {
    Object.assign(this, this.options)
    this.div.empty()
    this.isDrawing = false
    this.isErasing = false
    this.currentScreen = null
    this.screenMatrix = null

    // Create numScreens x numScreens matrix
    this.screenMatrix = Array(this.numScreens)
      .fill()
      .map(() =>
        Array(this.numScreens)
          .fill()
          .map(() => ({
            grid: Array(this.height)
              .fill()
              .map(() => Array(this.width).fill(0)),
            canvas: this.createCanvas(),
          }))
      )
    this.setupInterface()
    this.setupEventListeners()
    this.redrawAllGrids()
  }

  loadState(stateString) {
    assert(stateString.startsWith("{"), "State string must start with {")
    const state = JSON.parse(stateString)
    console.log("loading state", state)
    window.state = state
    this.numScreens = state.right.length + this.extraScreens
    this.height = state.right[0].length
    this.width = state.right[0][0].length
    this.initialize()
    console.log("storageKey", this.storageKey)

    // Load state into the new matrix format
    for (let i = 0; i < this.numScreens; i++) {
      for (let j = 0; j < this.numScreens; j++) {
        const leftState = state.left[i]
        const rightState = state.right[j]
        
        // Initialize empty grid
        const grid = Array(this.height).fill().map(() => Array(this.width).fill(0))
        
        // Copy left side from row's left state
        if (leftState) {
          for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width/2; x++) {
              grid[y][x] = leftState[y][x]
            }
          }
        }
        
        // Copy right side from column's right state
        if (rightState) {
          for (let y = 0; y < this.height; y++) {
            for (let x = this.width/2; x < this.width; x++) {
              grid[y][x] = rightState[y][x]
            }
          }
        }
        
        this.screenMatrix[i][j].grid = grid
      }
    }
    this.redrawAllGrids()
  }

  createStateString() {
    const right = []
    const left = []
    
    // For each row, collect left side state
    for (let i = 0; i < this.numScreens; i++) {
      const leftGrid = Array(this.height).fill().map(() => Array(this.width).fill(0))
      // Take left side from first column (j=0)
      const screen = this.screenMatrix[i][0]
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width/2; x++) {
          leftGrid[y][x] = screen.grid[y][x]
        }
      }
      left.push(leftGrid)
    }
    
    // For each column, collect right side state
    for (let j = 0; j < this.numScreens; j++) {
      const rightGrid = Array(this.height).fill().map(() => Array(this.width).fill(0))
      // Take right side from first row (i=0)
      const screen = this.screenMatrix[0][j]
      for (let y = 0; y < this.height; y++) {
        for (let x = this.width/2; x < this.width; x++) {
          rightGrid[y][x] = screen.grid[y][x]
        }
      }
      right.push(rightGrid)
    }

    return JSON.stringify({ right, left })
  }

  createCanvas() {
    // Add extra blockSize to width/height to account for grid padding
    const screenWidth = (this.width + 2) * this.blockSize
    const screenHeight = (this.height + 2) * this.blockSize

    return $("<canvas></canvas>")
      .attr({
        // Important: Set canvas attributes to match full size including padding
        width: screenWidth,
        height: screenHeight,
      })
      .css({
        border: "3px solid black",
        margin: "10px",
        "border-radius": "10px",
        "background-color": "white",
      })
  }

  setupInterface() {
    const gridContainer = $("<div>").css({
      display: "grid",
      gridTemplateColumns: `repeat(${this.numScreens}, auto)`,
      gap: "10px",
      justifyContent: "center",
    })

    // Create grid cells
    for (let i = 0; i < this.numScreens; i++) {
      for (let j = 0; j < this.numScreens; j++) {
        const cell = $("<div>").css({
          position: "relative",
        })
        this.screenMatrix[i][j].canvas.appendTo(cell)
        gridContainer.append(cell)
      }
    }

    this.buttonContainer = $("<div>")
      .css({
        display: "flex",
        justifyContent: "center",
        gap: "10px",
      })
      .appendTo(this.div)

    $("<button>")
      .text("Copy State")
      .css({
        margin: "10px",
        padding: "5px 15px",
      })
      .click(() => this.copyState())
      .appendTo(this.buttonContainer)

    $("<button>")
      .text("Load State")
      .css({
        margin: "10px",
        padding: "5px 15px",
      })
      .click(() => {
        const state = prompt("Enter state string:")
        if (state) {
          this.loadState(state)
        }
      })
      .appendTo(this.buttonContainer)

    $("<button>")
      .text("Toggle Colors")
      .css({
        margin: "10px",
        padding: "5px 15px",
      })
      .click(() => {
        this.showColors = !this.showColors
        this.redrawAllGrids()
      })
      .appendTo(this.buttonContainer)

    $("<button>")
      .text("Reset")
      .css({
        margin: "10px",
        padding: "5px 15px",
      })
      .click(() => {
        this.initialize()
      })
      .appendTo(this.buttonContainer)

    gridContainer.appendTo(this.div)
  }

  clearAllGrids() {
    this.screenMatrix.forEach((row) =>
      row.forEach((screen) => screen?.grid.forEach((row) => row.fill(0)))
    )
    this.redrawAllGrids()
  }

  clearGrid(row, col) {
    this.screenMatrix[row][col]?.grid.forEach((row) => row.fill(0))
    this.redrawAllGrids()
  }

  setupEventListeners() {
    $(document).on("keydown.drawing", (e) => {
      if (e.key.toLowerCase() === "c") {
        this.copyState()
      }
    })

    for (let i = 0; i < this.numScreens; i++) {
      for (let j = 0; j < this.numScreens; j++) {
        const screen = this.screenMatrix[i][j]
        screen.canvas
          .on("mousedown.drawing", (e) => this.startDrawing(e, i, j))
          .on("mousemove.drawing", (e) => this.draw(e))
          .on("mouseup.drawing", () => this.stopDrawing())
          .on("mouseleave.drawing", () => this.stopDrawing())
      }
    }
  }

  startDrawing(e, row, col) {
    const { x, y } = this.getGridCoordinates(e)
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.isDrawing = true
      this.currentScreen = { row, col }
      const currentGrid = this.screenMatrix[row][col].grid
      this.isErasing = currentGrid[y][x] !== 0
      this.draw(e)
    }
  }

  stopDrawing() {
    this.isDrawing = false
    this.isErasing = false
    this.currentScreen = null
  }

  draw(e) {
    if (!this.isDrawing || !this.currentScreen) return

    const { x, y } = this.getGridCoordinates(e)
    const { row, col } = this.currentScreen
    
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      const newValue = this.isErasing ? 0 : (x >= this.width/2 ? 2 : 1)
      
      // For left side (x < width/2), sync across the row
      if (x < this.width/2) {
        for (let j = 0; j < this.numScreens; j++) {
          this.screenMatrix[row][j].grid[y][x] = newValue
        }
      }
      // For right side (x >= width/2), sync across the column
      else {
        for (let i = 0; i < this.numScreens; i++) {
          this.screenMatrix[i][col].grid[y][x] = newValue
        }
      }
    }
    this.redrawAllGrids()
  }

  getGridCoordinates(e) {
    const rect = e.target.getBoundingClientRect()
    // Subtract 1 from both coordinates to account for grid padding
    const x = Math.floor((e.clientX - rect.left) / this.blockSize) - 1
    const y = Math.floor((e.clientY - rect.top) / this.blockSize) - 1
    return { x, y }
  }

  redrawGrid(row, col) {
    const screen = this.screenMatrix[row][col]
    if (!screen.grid) throw new Error(`Screen ${row},${col} not found`)
    const ctx = screen.canvas[0].getContext("2d")

    // Clear the full canvas
    ctx.clearRect(
      0,
      0,
      (this.width + 2) * this.blockSize,
      (this.height + 2) * this.blockSize
    )

    // Draw grid lines
    ctx.strokeStyle = "lightgray"
    ctx.lineWidth = 1

    // Draw vertical lines (add 1 to include rightmost line)
    for (let x = 0; x <= this.width + 1; x++) {
      if (x === Math.floor(this.width / 2) + 1) {
        ctx.strokeStyle = "#999"
        ctx.lineWidth = 2
      } else {
        ctx.strokeStyle = "lightgray"
        ctx.lineWidth = 1
      }
      ctx.beginPath()
      ctx.moveTo(x * this.blockSize, this.blockSize)
      ctx.lineTo(x * this.blockSize, (this.height + 1) * this.blockSize)
      ctx.stroke()
    }

    // Draw horizontal lines (add 1 to include bottom line)
    for (let y = 0; y <= this.height + 1; y++) {
      ctx.beginPath()
      ctx.moveTo(this.blockSize, y * this.blockSize)
      ctx.lineTo((this.width + 1) * this.blockSize, y * this.blockSize)
      ctx.stroke()
    }

    // Draw filled blocks
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let k = screen.grid[y][x]
        if (k !== 0) {
          if (this.showColors) {
            ctx.fillStyle = COLORS[k]
          } else {
            ctx.fillStyle = k == 4 ? "black" : COLORS[3]
          }
          ctx.fillRect(
            (x + 1) * this.blockSize,
            (y + 1) * this.blockSize,
            this.blockSize,
            this.blockSize
          )
        }
      }
    }
  }

  redrawAllGrids() {
    console.log("saving state")
    localStorage.setItem(this.storageKey, this.createStateString())

    for (let i = 0; i < this.numScreens; i++) {
      for (let j = 0; j < this.numScreens; j++) {
        this.redrawGrid(i, j)
      }
    }
  }

  copyState() {
    const state = this.createStateString()
    console.log(state)
    navigator.clipboard.writeText(state)
  }

  attach(display) {
    display.empty()
    this.div.appendTo(display)
    return this
  }
}
