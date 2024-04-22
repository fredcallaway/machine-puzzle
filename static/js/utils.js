
class ConditionBuilder {
  constructor(condition) {
    this.state = condition;
  }

  choose(choices, {rand=false, pop=false} = {}) {
    let indices = (arr) => [...arr.keys()];
    let range = (n) => indices(Array(n));
    let randInt = (n) => Math.floor(Math.random() * n);

    if (typeof choices == 'number') {
      choices = range(choices);
    }
    let i;
    if (rand) {
      i = randInt(choices.length);
    } else {
      i = this.state % choices.length;
      this.state = Math.floor(this.state / choices.length);
    }
    return pop ? choices.splice(i, 1)[0] : choices[i];
  }

  chooseMulti(choicesObj) {
    let result = {};
    for (let [key, choices] of Object.entries(choicesObj)) {
      if (Array.isArray(choices)) {
        result[key] = this.choose(choices);
      } else {
        result[key] = choices;
      }
    }
    return result;
  }
}

function conditionParameters(condition, choicesObj) {
  return new ConditionBuilder(condition).chooseMulti(choicesObj)
}

function enforceScreenSize(width, height, display='#display') {
  display = $(display)

  warning = $('<div>')
  .addClass('alert alert-warning center')
  .css({
    'width': 400,
    // 'position': 'absolute',
    // 'top': '30%',
    'margin': 'auto',
    'margin-top': '100px'
  })
  .html(`
    <h4>Screen too small</h4>

    <p>Your window isn't big enough to run the experiment. Please try expanding the window.
    It might help to use full screen mode.
  `).hide()
  .appendTo(document.body)

  $('<button>').addClass('btn btn-primary').css('margin-top', '20px').text('enter fullscreen').appendTo(warning)
  .click(() => {
    document.documentElement.requestFullscreen()
  })



  function enforcer() {
    if (window.innerWidth < width || window.innerHeight < height) {
      warning.show()
      display.hide()
    } else {
      warning.hide()
      display.show()
    }
  }
  window.addEventListener('resize', enforcer);
  enforcer()
  return enforcer
}

async function runTimeline(...blocks) {
  let start = _.map(blocks, 'name').indexOf(urlParams.block)
  if (start != -1) {
    blocks = blocks.slice(start)
  }
  for (const block of blocks) {
    logEvent('timeline.start.' + block.name)
    await block()
    logEvent('timeline.end.' + block.name)
  }
}



function make_promise() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.resolve = resolve
  promise.reject = reject
  return promise
}

function hex2rgb(hex) {
  // Convert hex color to rgb
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}


class EventListeners {
  constructor() {
    this.listeners = []
  }
  on(type, handler, options) {
    this.listeners.push([type, handler, options])
    document.addEventListener(type, handler, options)
  }
  clear() {
    for (let [ltype, handler, options] of this.listeners) {
      document.removeEventListener(ltype, handler, options)
    }
    this.listeners.length = 0 // weird way to clear an array
  }
}
const globalListeners = new EventListeners()

function updateExisting(target, src) {
  Object.keys(target)
        .forEach(k => target[k] = (src.hasOwnProperty(k) ? src[k] : target[k]));
}

function maybeJson(s) {
  try {
    return JSON.parse(s);
  } catch (error) {
    return s;
  }
};

function getKeyPress(options) {
  return new Promise(function(resolve) {
    return jsPsych.pluginAPI.getKeyboardResponse({
      valid_responses: options,
      persist: false,
      allow_held_key: false,
      callback_function: (info) => {
        info.key = String.fromCharCode(info.key);
        if (info.key == ' ') {
          info.key = 'space';
        }
        return resolve(info);
      }
    });
  });
};

function mod(n, k) {
  return ((n % k) + k) % k
}

const cartesian = (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));


// Generated by CoffeeScript 2.0.2
var assert, check, checkObj, converter, delay, mapObject, markdown, mean, sleep, zip;

converter = new showdown.Converter();

markdown = function(txt) {
  // Remove leading spaces so as not to interpret indented
  // blocks as code blocks. Use fenced code blocks instead.
  return converter.makeHtml(txt.replace(/^[ ]+/gm, ''));
};

delay = function(time, func) {
  return setTimeout(func, time);
};

sleep = function(ms) {
  return new Promise(function(resolve) {
    return window.setTimeout(resolve, ms);
  });
};

zip = function(...rows) {
  return rows[0].map(function(_, c) {
    return rows.map(function(row) {
      return row[c];
    });
  });
};

mapObject = function(obj, fn) {
  return Object.keys(obj).reduce(function(res, key) {
    res[key] = fn(obj[key]);
    return res;
  }, {});
};

mean = function(xs) {
  return (xs.reduce((function(acc, x) {
    return acc + x;
  }))) / xs.length;
};

checkObj = function(obj, keys) {
  var i, k, len;
  if (keys == null) {
    keys = Object.keys(obj);
  }
  for (i = 0, len = keys.length; i < len; i++) {
    k = keys[i];
    if (obj[k] === void 0) {
      console.log('Bad Object: ', obj);
      throw new Error(`${k} is undefined`);
    }
  }
  return obj;
};

check = function(name, val) {
  if (val === void 0) {
    throw new Error(`${name}is undefined`);
  }
  return val;
};

assert = function(val, msg='(no details)') {
  if (!val) {
    throw new Error('Assertion Error: ' + msg);
  }
  return val;
};
