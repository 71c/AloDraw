var socket;

var canvas = document.createElement('canvas');

// drag vs click detection
// https://stackoverflow.com/a/6042235
var dragging = false;


var ctx;

var image = new Image;

var width;
var height;
var chunkSize;
var chunkRows;
var chunkCols;
var chunksLoaded;

var pixel;

var currentColor = 'rgb(34, 34, 34)';

var idata;

var alreadyExpanded = false;

var requesting = true;

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

document.addEventListener('DOMContentLoaded', () => {
  showBrowserCompatibilityWarnings();

  socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

  socket.emit('request image dimensions');

  window.onbeforeunload = function() {
    socket.emit('exit site', { user_id: localStorage.getItem('user_id') });
  };

  socket.on('send user count', data => {
    // update user count
    document.getElementById('user_count').innerHTML = data.user_count + ' online';
  });

  // when it recieves the dimensions, set those and also initialize other things.
  socket.on('give image dimensions', data => {
    width = data.width;
    height = data.height;

    chunkSize = data.chunk_size;
    chunkRows = Math.ceil(height / chunkSize);
    chunkCols = Math.ceil(width / chunkSize);
    chunksLoaded = Array(chunkRows);
    for (var i = 0; i < chunkRows; i++) {
      chunksLoaded[i] = Array(chunkCols).fill(false);
    }

    canvas.width = width;
    canvas.height = height;
    document.body.append(canvas);

    socket.emit('request chunks', { chunks: getImageChunks(), first_time: true });
  });

  // write pixels when server sends chunks
  socket.on('send chunks', data => {
    if (data.first_time) {
      initialize();
    }

    data.chunks.forEach(function(chunk) {
      var buffer = new Uint8ClampedArray(chunk.buffer);
      idata.data.set(buffer);
      ctx.putImageData(idata, chunk.rectangle[0], chunk.rectangle[1]);
    });
  });

  // create the color swatch area
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

  socket.on('broadcast change pixels', data => {
    for (let pixel_change of data.pixel_changes) {
      pixel.data[0] = pixel_change.color[0];
      pixel.data[1] = pixel_change.color[1];
      pixel.data[2] = pixel_change.color[2];
      ctx.putImageData(pixel, pixel_change.x, pixel_change.y);
    }
  });

  socket.on('give new user id', data => {
    localStorage.setItem('user_id', data.user_id);
  });

});

function initialize() {
  ctx = canvas.getContext('2d', { alpha: false });
  image.src = canvas.toDataURL();
  pixel = ctx.createImageData(1, 1);
  pixel.data[3] = 255;

  canvas.addEventListener("mousedown", function() {
    dragging = false;
  }, false);
  canvas.addEventListener("mousemove", function() {
    dragging = true;
  }, false);
  canvas.addEventListener("mouseup", handleCanvasMouseup, false);

  idata = ctx.createImageData(chunkSize, chunkSize);
  ctx.drawImage(image, 0, 0);


  canvas.style.left = '-' + initialX + 'px';
  canvas.style.top = '-' + initialY + 'px';

  // make the canvas pannable and zoomable with this awesome plugin
  panzoom(canvas, {
    smoothScroll: false,
    zoomDoubleClickSpeed: 1, // disable double-click
    minZoom: 1,
    maxZoom: 10
  });

  if (!localStorage.getItem('user_id')) {
    socket.emit('request new user id');
  }
  else {
    socket.emit('enter site', { user_id: localStorage.getItem('user_id') });
  }
}

// when the mouse clicks on the canvas, do something depending on if it's dragging or not
function handleCanvasMouseup(event) {
  // if mouse is dragging canvas,
  if (dragging) {
    let r = getImageRectangle();
    let x = r[0];
    let y = r[1];
    // change the URL to that of the position
    window.history.pushState(null, null, '/' + x + ',' + y);
    // request chunks if not all chunks are loaded
    if (requesting)
      requestChunks();
    return;
  }
  placePixel(event);
}

//
function placePixel(event) {
  // get x and y positions of the mouse relative to the canvas.
  var rect = canvas.getBoundingClientRect();
  var x = Math.floor((event.clientX - rect.x) / rect.width * width);
  var y = Math.floor((event.clientY - rect.y) / rect.height * height);

  // the color of the new pixel
  var newColor = currentColor.match(/\d+/g).map(s => parseInt(s, 10));

  // put this pixel on the canvas
  for (var i = 0; i < 3; i++)
    pixel.data[i] = newColor[i];
  ctx.putImageData(pixel, x, y);

  socket.emit('change pixel', {
    color: newColor,
    x: x,
    y: y,
    user_id: localStorage.getItem('user_id')
  });
}

// get the rectangle of the viewing window relative to the image
function getImageRectangle(rect = canvas.getBoundingClientRect()) {
  var x = Math.max(-rect.x, 0);
  var y = Math.max(-rect.y, 0);
  var pixelX = Math.floor(x / rect.width * width);
  var pixelY = Math.floor(y / rect.height * height);

  var right = window.innerWidth - rect.x;
  var bottom = window.innerHeight - rect.y;
  var pixelRight = Math.min(Math.floor(right / rect.width * width), width);
  var pixelBottom = Math.min(Math.floor(bottom / rect.height * height), height);

  return [pixelX, pixelY, pixelRight, pixelBottom];
}

// request chunks from the server
function requestChunks() {
  var rect = canvas.getBoundingClientRect();
  var chunks = getImageChunks(rect);
  if (chunks.length > 0) {
    chunks.forEach(function(chunk) {
      // set all the chunks that will be loaded to be loaded beforehand, to make sure they aren't loaded twice
      chunksLoaded[chunk.i][chunk.j] = true;
    });
    socket.emit('request chunks', { chunks: chunks, first_time: false });
    alreadyExpanded = false;
  }
  // if all the chunks in the window are already loaded, request more chunks that are outside the window.
  // I added this to try to make the loading speedier and more seamless.
  else if (!alreadyExpanded) {
    rect.x -= chunkSize;
    rect.y -= chunkSize;
    rect.width += chunkSize;
    rect.height += chunkSize;
    chunks = getImageChunks(rect);
    if (chunks.length > 0) {
      chunks.forEach(function(chunk) {
        chunksLoaded[chunk.i][chunk.j] = true;
      });
      socket.emit('request chunks', { chunks: chunks, first_time: false });
      alreadyExpanded = true;
    }
  }
  if (chunksLoaded.every(row => row.every(col => col))) {
    requesting = false;
  }
}

// return the chunks contained in the given rectangle that aren't loaded yet
function getImageChunks(rect = canvas.getBoundingClientRect()) {
  var box = getImageRectangle(rect);
  var pixelX = box[0];
  var pixelY = box[1];
  var pixelRight = box[2];
  var pixelBottom = box[3];

  var minChunkX = Math.floor(pixelX / chunkSize) * chunkSize;
  var minChunkY = Math.floor(pixelY / chunkSize) * chunkSize;
  var maxChunkRight = Math.min(Math.ceil(pixelRight / chunkSize) * chunkSize, width);
  var maxChunkBottom = Math.min(Math.ceil(pixelBottom / chunkSize) * chunkSize, height);

  var chunks = [];
  for (var row = minChunkY; row < maxChunkBottom; row += chunkSize) {
    for (var col = minChunkX; col < maxChunkRight; col += chunkSize) {
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

function showBrowserCompatibilityWarnings() {
  let warningsByBrowser = {
    safari: 'I can\'t get the pixels to not get blurry in Safari so would you please switch to another browser like Chrome or Firefox?'
  };
  var message = warningsByBrowser[getUserBrowser()];
  if (message) {
    let warning = generateAlert(message);
    document.body.prepend(warning);
  }
}

function generateAlert(message) {
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