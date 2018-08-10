var socket;

// drag vs click detection
// https://stackoverflow.com/a/6042235
var dragging = false;

var canvasContext;

var image = new Image;

var chunkSize;
var chunksLoaded;

var currentColor = 'rgb(34, 34, 34)';

var alreadyExpanded = false;

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
    renderCanvas({
      width: data.width,
      height: data.height,
      x: initialX,
      y: initialY
    });
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
  var x = Math.floor((event.clientX - rect.x) / rect.width * canvas.width);
  var y = Math.floor((event.clientY - rect.y) / rect.height * canvas.height);

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
  var pixelX = Math.floor(x / rect.width * canvas.width);
  var pixelY = Math.floor(y / rect.height * canvas.height);

  var right = window.innerWidth - rect.x;
  var bottom = window.innerHeight - rect.y;
  var pixelRight = Math.min(Math.floor(right / rect.width * canvas.width), canvas.width);
  var pixelBottom = Math.min(Math.floor(bottom / rect.height * canvas.height), canvas.height);

  return {
    left: pixelX,
    top: pixelY,
    right: pixelRight,
    bottom: pixelBottom
  };
}

// request chunks from the server
function requestChunks() {
  var rect = canvas.getBoundingClientRect();
  var chunks = getVisibleUnloadedChunks(rect);
  if (chunks.length > 0) {
    chunks.forEach(function(chunk) {
      // set all the chunks that will be loaded to be loaded beforehand, to make sure they aren't loaded twice
      chunksLoaded[chunk.i][chunk.j] = true;
    });
    socket.emit('request chunks', { chunks: chunks});
    alreadyExpanded = false;
  }
  // if all the chunks in the window are already loaded, request more chunks that are outside the window.
  // I added this to try to make the loading speedier and more seamless.
  else if (!alreadyExpanded) {
    rect.x -= chunkSize;
    rect.y -= chunkSize;
    rect.width += chunkSize;
    rect.height += chunkSize;
    chunks = getVisibleUnloadedChunks(rect);
    if (chunks.length > 0) {
      chunks.forEach(function(chunk) {
        chunksLoaded[chunk.i][chunk.j] = true;
      });
      socket.emit('request chunks', { chunks: chunks });
      alreadyExpanded = true;
    }
  }
  if (chunksLoaded.every(row => row.every(col => col))) {
    requesting = false;
  }
}

// return the chunks contained in the given rectangle that aren't loaded yet
function getVisibleUnloadedChunks(rect = canvas.getBoundingClientRect()) {
  let imageRect = getImageRectangle(rect);

  var minChunkX = Math.floor(imageRect.left / chunkSize) * chunkSize;
  var minChunkY = Math.floor(imageRect.top / chunkSize) * chunkSize;
  var maxChunkRight = Math.min(Math.ceil(imageRect.right / chunkSize) * chunkSize, canvas.width);
  var maxChunkBottom = Math.min(Math.ceil(imageRect.bottom / chunkSize) * chunkSize, canvas.height);

  var chunks = [];
  for (var row = minChunkY; row < maxChunkBottom; row += chunkSize) {
    for (var col = minChunkX; col < maxChunkRight; col += chunkSize) {
      if (!chunksLoaded[row / chunkSize][col / chunkSize]) {
        chunks.push({
          rectangle: [col, row, Math.min(col + chunkSize, canvas.width), Math.min(row + chunkSize, canvas.height)],
          i: row / chunkSize,
          j: col / chunkSize
        });
      }
    }
  }
  return chunks;
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
  var table = document.getElementById('colors');
  var i = 0;
  for (var y = 0; y < 2; y++) {
    var row = document.createElement('tr');
    for (var x = 0; x < 8; x++) {
      var color = colors[i];
      var swatch = document.createElement('div');
      swatch.style.backgroundColor = color;
      swatch.style.width = '20px';
      swatch.style.height = '20px';
      swatch.onclick = function() {
        currentColor = this.style.backgroundColor;
      };
      var col = document.createElement('td');
      col.append(swatch);
      row.append(col);
      i++;
    }
    table.append(row);
  }
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

function renderCanvas(params) {
  canvas = document.createElement('canvas');
  canvas.width = params.width;
  canvas.height = params.height;
  canvas.style.left = '-' + params.x + 'px';
  canvas.style.top = '-' + params.y + 'px';
  canvas.addEventListener("mousedown", function() {
    dragging = false;
  }, false);
  canvas.addEventListener("mousemove", function() {
    dragging = true;
  }, false);
  canvas.addEventListener("mouseup", handleCanvasMouseup, false);
  document.body.append(canvas);
  panzoom(canvas, {
    smoothScroll: false,
    zoomDoubleClickSpeed: 1,
    minZoom: 1,
    maxZoom: 10
  });
  canvasContext = canvas.getContext('2d', { alpha: false });
  image.src = canvas.toDataURL();
  canvasContext.drawImage(image, 0, 0);
}

function setChunksLoaded() {
  let chunkRowCount = Math.ceil(canvas.height / chunkSize);
  let chunkColCount = Math.ceil(canvas.width / chunkSize);
  chunksLoaded = createFilled2dArray(chunkRowCount, chunkColCount, false);
}