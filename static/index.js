var socket;

var canvas = document.createElement('canvas');

var dragging = false;
canvas.addEventListener("mousedown", function() {
  dragging = false;
}, false);
canvas.addEventListener("mousemove", function() {
  dragging = true;
}, false);
canvas.addEventListener("mouseup", placePixel, false);


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

var requesting;

// gives the browser that the user is using, or the userAgent if the browser is neither of these.
var browser = function() {
  return is.ie() ? 'IE' :
    is.edge() ? 'Edge' :
    is.opera() ? 'Opera' :
    is.chrome() ? 'Chrome' :
    is.firefox() ? 'Firefox' :
    is.safari() ? 'Safari' :
    navigator.userAgent;
};

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
  // window.history.pushState(null, null, '/test');
  if (is.safari()) {
    var warning = document.createElement('div');
    warning.setAttribute('class', 'alert alert-warning');
    warning.setAttribute('role', 'alert');
    warning.innerHTML = 'I can\'t get the pixels to not get blurry in Safari so would you please switch to another browser like Chrome or Firefox?';
    document.body.prepend(warning);
  }

  socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

  socket.emit('request image dimensions');

  window.onbeforeunload = function() {
    socket.emit('exit site', { 'id': localStorage.getItem('id') });
  };

  socket.on('send user count', data => {
    document.getElementById('user_count').innerHTML = data.user_count + ' online';
  });

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

    socket.emit('request chunks', { chunks: getImageChunks(canvas.getBoundingClientRect()), 'first_time': true });
  });

  socket.on('send chunks', data => {
    if (data.first_time) {
      ctx = canvas.getContext('2d', { alpha: false });
      image.src = canvas.toDataURL();
      pixel = ctx.createImageData(1, 1);
      pixel.data[3] = 255;
      requesting = setInterval(requestChunks, 1000);
      idata = ctx.createImageData(chunkSize, chunkSize);
      ctx.drawImage(image, 0, 0);
    }

    data.chunks.forEach(function(chunk) {
      var buffer = new Uint8ClampedArray(chunk.buffer);
      idata.data.set(buffer);
      ctx.putImageData(idata, chunk.rectangle[0], chunk.rectangle[1]);
    });

    if (data.first_time) {
      panzoom(canvas, {
        smoothScroll: false,
        zoomDoubleClickSpeed: 1,
        minZoom: 1,
        maxZoom: 10
      });

      if (!localStorage.getItem('id')) {
        socket.emit('request new user id');
      }
      else {
        socket.emit('enter site', { 'id': localStorage.getItem('id') });
      }
    }
  });

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
    console.log('got some pixel changes');
    for (let pixel_change of data.pixel_changes) {
      pixel.data[0] = pixel_change.color[0];
      pixel.data[1] = pixel_change.color[1];
      pixel.data[2] = pixel_change.color[2];
      ctx.putImageData(pixel, pixel_change.x, pixel_change.y);
    }
  });

  socket.on('give new user id', data => {
    localStorage.setItem('id', data.id);
  });

});

function placePixel(event) {
  // if mouse is dragging canvas, don't place pixel
  if (dragging) {
    var r = getImageRectangle();
    var x = r[0];
    var y = r[1];
    window.history.pushState(null, null, '/' + x + ',' + y);
    return;
  }

  var rect = this.getBoundingClientRect();
  var x = Math.floor((event.clientX - rect.x) / rect.width * width);
  var y = Math.floor((event.clientY - rect.y) / rect.height * height);

  var oldColor = ctx.getImageData(x, y, 1, 1).data.slice(0, 3);
  var newColor = currentColor.match(/\d+/g).map(s => parseInt(s, 10));

  var sameColorAlreadyThere = oldColor.every((n, i) => n === newColor[i]);
  // if the same color was already there don't place pixel
  if (sameColorAlreadyThere)
    return;

  for (var i = 0; i < 3; i++)
    pixel.data[i] = newColor[i];
  ctx.putImageData(pixel, x, y);

  socket.emit('change pixel', {
    'color': newColor,
    'x': x,
    'y': y,
    'id': localStorage.getItem('id')
  });
}

function getImageRectangle() {
  var rect = canvas.getBoundingClientRect();
  var x = Math.max(-rect.x, 0);
  var y = Math.max(-rect.y, 0);
  var pixelX = Math.floor(x / rect.width * width);
  var pixelY = Math.floor(y / rect.height * height);

  var right = window.innerWidth - rect.x;
  var bottom = window.innerHeight - rect.y;
  var pixelRight = Math.min(Math.floor(right / rect.width * width), width);
  var pixelBottom = Math.min(Math.floor(bottom / rect.height * height), height);

  var minChunkX = Math.floor(pixelX / chunkSize) * chunkSize;
  var minChunkY = Math.floor(pixelY / chunkSize) * chunkSize;
  var maxChunkRight = Math.min(Math.ceil(pixelRight / chunkSize) * chunkSize, width);
  var maxChunkBottom = Math.min(Math.ceil(pixelBottom / chunkSize) * chunkSize, height);

  return [pixelX, pixelY, pixelRight, pixelBottom];
}

function requestChunks() {
  var rect = canvas.getBoundingClientRect();
  var chunks = getImageChunks(rect);
  if (chunks.length > 0) {
    chunks.forEach(function(chunk) {
      chunksLoaded[chunk.i][chunk.j] = true;
    });
    socket.emit('request chunks', { chunks: chunks, 'first_time': false });
    alreadyExpanded = false;
  }
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
      socket.emit('request chunks', { chunks: chunks, 'first_time': false });
      alreadyExpanded = true;
    }
  }
  if (chunksLoaded.every(row => row.every(col => col))) {
    clearInterval(requesting);
  }
}

function getImageChunks(rect) {
  var x = Math.max(-rect.x, 0);
  var y = Math.max(-rect.y, 0);
  var pixelX = Math.floor(x / rect.width * width);
  var pixelY = Math.floor(y / rect.height * height);

  var right = window.innerWidth - rect.x;
  var bottom = window.innerHeight - rect.y;
  var pixelRight = Math.min(Math.floor(right / rect.width * width), width);
  var pixelBottom = Math.min(Math.floor(bottom / rect.height * height), height);

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
