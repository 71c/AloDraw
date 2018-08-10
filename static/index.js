var socket;

// drag vs click detection
// https://stackoverflow.com/a/6042235
var dragging = false;

var canvasContext;

var image = new Image;

var chunkSize;
var width;
var height;

var chunksLoaded;

var currentColor = 'rgb(34, 34, 34)';

var requesting = true;

var canvas;


// the colors to choose from
var colors = [
  'rgb(255, 255, 255)',
  'rgb(228, 228, 228)',
  'rgb(136, 136, 136)',
  'rgb(34, 34, 34)',
  'rgb(255, 167, 209)',
  'rgb(229, 0, 0)',
  'rgb(229, 149, 0)',
  'rgb(160, 106, 66)',
  'rgb(229, 217, 0)',
  'rgb(148, 224, 68)',
  'rgb(2, 190, 1)',
  'rgb(0, 211, 221)',
  'rgb(0, 131, 199)',
  'rgb(0, 0, 234)',
  'rgb(207, 110, 228)',
  'rgb(130, 0, 128)',
];

var user_id = localStorage.getItem('user_id');

document.addEventListener('DOMContentLoaded', () => {

  var userCountElement = document.getElementById('user_count');

  renderBrowserCompatibilityWarnings();

  socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

  socket.emit('request image dimensions');
  if (!user_id) {
    socket.emit('request new user id');
  }
  else {
    socket.emit('enter site', { user_id: user_id });
  }

  window.onbeforeunload = function() {
    socket.emit('exit site', { user_id: user_id });
  };

  socket.on('send user count', data => {
    userCountElement.innerHTML = data.user_count + ' online';
  });

  socket.on('give image dimensions', data => {
    chunkSize = data.chunk_size;
    width = data.width;
    height = data.height;
    renderCanvas(initialX, initialY);
    setCanvasImage();
    setChunksLoaded();
    socket.emit('request chunks', { chunks: getVisibleUnloadedChunks()});
  });

  // write pixels when server sends chunks
  socket.on('send chunks', data => {
    data.chunks.forEach(function(chunk) {
      let chunkHolder = canvasContext.createImageData(chunkSize, chunkSize);
      let buffer = new Uint8ClampedArray(chunk.buffer);
      chunkHolder.data.set(buffer);
      canvasContext.putImageData(chunkHolder, chunk.rectangle[0], chunk.rectangle[1]);
    });
  });

  // create the color swatch area
  renderSwatches();


  socket.on('broadcast change pixels', data => {
    let pixelHolder = canvasContext.createImageData(1, 1);
    for (let pixel_change of data.pixel_changes) {
      pixelHolder.data[0] = pixel_change.color[0];
      pixelHolder.data[1] = pixel_change.color[1];
      pixelHolder.data[2] = pixel_change.color[2];
      pixelHolder.data[3] = 255;
      canvasContext.putImageData(pixelHolder, pixel_change.x, pixel_change.y);
    }
  });

  socket.on('give new user id', data => {
    localStorage.setItem('user_id', data.user_id);
  });

});

// when the mouse clicks on the canvas, do something depending on if it's dragging or not
function handleCanvasMouseup(event) {
  // if mouse is dragging canvas,
  if (dragging) {
    let imageRect = getImageRectangle();
    // change the URL to that of the position
    window.history.pushState(null, null, '/' + imageRect.left + ',' + imageRect.top);
    // request chunks if not all chunks are loaded
    if (requesting)
      requestChunks();
    return;
  }
  placePixel(event);
}


function placePixel(event) {
  // get x and y positions of the mouse relative to the canvas.
  var rect = canvas.getBoundingClientRect();
  var x = Math.floor((event.clientX - rect.x) / rect.width * width);
  var y = Math.floor((event.clientY - rect.y) / rect.height * height);

  // the color of the new pixel
  var newColor = currentColor.match(/\d+/g).map(s => parseInt(s, 10));

  // put this pixel on the canvas
  let pixelHolder = canvasContext.createImageData(1, 1);
  for (var i = 0; i < 3; i++)
    pixelHolder.data[i] = newColor[i];
  canvasContext.putImageData(pixelHolder, x, y);

  socket.emit('change pixel', {
    color: newColor,
    x: x,
    y: y,
    user_id: user_id
  });
}

// get the rectangle of the viewing window relative to the image
function getImageRectangle(rect = canvas.getBoundingClientRect()) {
  var x = Math.max(-rect.x, 0);
  var y = Math.max(-rect.y, 0);
  var pixelX = Math.floor(x / rect.width * width);
  var pixelY = Math.floor(y / rect.height * height);

  var right = Math.min(window.innerWidth - rect.x, width);
  var bottom = Math.min(window.innerHeight - rect.y, height);
  var pixelRight = Math.floor(right / rect.width * width);
  var pixelBottom = Math.floor(bottom / rect.height * height);

  return {
    left: pixelX,
    top: pixelY,
    right: pixelRight,
    bottom: pixelBottom
  };
}

// request chunks from the server
function requestChunks() {
  var chunks = getVisibleUnloadedChunks();
  if (chunks.length > 0) {
    chunks.forEach(function(chunk) {
      chunksLoaded[chunk.i][chunk.j] = true;
    });
    socket.emit('request chunks', {chunks: chunks});
  }
  if (chunksLoaded.every(row => row.every(col => col))) {
    requesting = false;
  }
}

// return the chunks contained in the given rectangle that aren't loaded yet
function getVisibleUnloadedChunks(rect=canvas.getBoundingClientRect()) {
  let imageRect = getImageRectangle(rect);

  let left = quantizeToChunkFloor(imageRect.left);
  let top = quantizeToChunkFloor(imageRect.top);
  let right = Math.min(quantizeToChunkCeil(imageRect.right), width);
  let bottom = Math.min(quantizeToChunkCeil(imageRect.bottom), height);

  let chunks = [];
  for (let row = top; row < bottom; row += chunkSize) {
    for (let col = left; col < right; col += chunkSize) {
      if (!chunksLoaded[row / chunkSize][col / chunkSize]) {
        chunks.push({
          rectangle: [col, row, Math.min(col + chunkSize, width), Math.min(row + chunkSize, height)],
          i: row / chunkSize,
          j: col / chunkSize
        });
      }
    }
  }
  return chunks;
}

function quantizeToChunkFloor(number) {
  return Math.floor(number / chunkSize) * chunkSize;
}

function quantizeToChunkCeil(number) {
  return Math.ceil(number / chunkSize) * chunkSize;
}

function renderBrowserCompatibilityWarnings() {
  let warningsByBrowser = {
    safari: 'I can\'t get the pixels to not get blurry in Safari so would you please switch to another browser like Chrome or Firefox?'
  };
  var message = warningsByBrowser[getUserBrowser()];
  if (message) {
    let warning = createAlert(message);
    document.body.prepend(warning);
  }
}

function renderSwatches() {
  let table = document.getElementById('colors');
  let cols = 8;
  let row;
  colors.forEach((color, index) => {
    if (index % cols === 0) {
      row = document.createElement('tr');
      table.append(row);
    }
    let swatch = document.createElement('td');
    row.append(swatch);
    swatch.style.backgroundColor = color;
    swatch.style.width = '20px';
    swatch.style.height = '20px';
    swatch.onclick = function() {
      currentColor = this.style.backgroundColor;
    };
  });
}

function createAlert(message) {
  var warning = document.createElement('div');
  warning.setAttribute('class', 'alert alert-warning');
  warning.setAttribute('role', 'alert');
  warning.innerHTML = message;
  return warning;
}

function getUserBrowser() {
  let browser = is.ie() ? 'internet explorer' :
      is.edge() ? 'edge' :
      is.opera() ? 'opera' :
      is.chrome() ? 'chrome' :
      is.firefox() ? 'firefox' :
      is.safari() ? 'safari' :
      navigator.userAgent;
  return browser;
}

function createFilled2dArray(rowCount, colCount, val) {
  let arr = Array(rowCount);
  for (let i = 0; i < rowCount; i++) {
    arr[i] = Array(colCount).fill(val);
  }
  return arr;
}

function createCanvas() {
  let canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.addEventListener("mousedown", function() {
    dragging = false;
  }, false);
  canvas.addEventListener("mousemove", function() {
    dragging = true;
  }, false);
  canvas.addEventListener("mouseup", handleCanvasMouseup, false);
  return canvas;
}

function renderCanvas(x, y) {
  canvas = createCanvas();
  canvas.style.left = '-' + x + 'px';
  canvas.style.top = '-' + y + 'px';
  document.body.append(canvas);
  panzoom(canvas, {
    smoothScroll: false,
    zoomDoubleClickSpeed: 1,
    minZoom: 1,
    maxZoom: 10
  });
}

function setCanvasImage() {
  canvasContext = canvas.getContext('2d', { alpha: false });
  image.src = canvas.toDataURL();
  canvasContext.drawImage(image, 0, 0);
}

function setChunksLoaded() {
  let rowCount = Math.ceil(height / chunkSize);
  let colCount = Math.ceil(width / chunkSize);
  chunksLoaded = createFilled2dArray(rowCount, colCount, false);
}