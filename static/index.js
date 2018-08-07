var socket;

var canvas = document.createElement('canvas');
canvas.onclick = getMousePosition;

var ctx;

var image = new Image;

var width;
var height;

var zoomLevel = 1;

var currentColor = 'rgb(34, 34, 34)';

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
  socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);




  socket.emit('request image');


  window.onbeforeunload = function() {
    socket.emit('exit site', {'id': localStorage.getItem('id')});
  };

  socket.on('send user count', data => {
    document.getElementById('user_count').innerHTML = data.user_count;
  });

  socket.on('send image', data => {
    width = data.width;
    height = data.height;

    var buffer = new Uint8ClampedArray(data.buffer);
    console.log(buffer);

    ctx = canvas.getContext('2d');

    canvas.width = width;
    canvas.height = height;

    var idata = ctx.createImageData(width, height);
    idata.data.set(buffer);
    ctx.putImageData(idata, 0, 0);

    image.src = canvas.toDataURL();

    ctx.drawImage(image,0,0);
    canvas.style.position = 'absolute';
    document.body.append(canvas);


    panzoom(canvas, {
      smoothScroll: false,
      zoomDoubleClickSpeed: 1,
      minZoom: 1,
      maxZoom: 10
    });

    if (! localStorage.getItem('id')) {
      socket.emit('request new user id');
    } else {
      socket.emit('enter site', {'id': localStorage.getItem('id')});
    }



    socket.emit('request user count');
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



  socket.on('broadcast change pixel', data => {
    var imgData = ctx.getImageData(0,0,canvas.width,canvas.height);

    var index = data.index;

    imgData.data[index] = data.color[0];
    imgData.data[index + 1] = data.color[1];
    imgData.data[index + 2] = data.color[2];

    ctx.putImageData(imgData, 0, 0);
  });

  socket.on('give new user id', data => {
    localStorage.setItem('id', data.id);
  });


});



function changeColor(x, y) {
  socket.emit('change pixel', {
    'color': currentColor,
    'x': x,
    'y': y
  });
}


function getMousePosition(event) {
  var rect = this.getBoundingClientRect();

  var x = event.clientX - rect.x;
  var y = event.clientY - rect.y;

  var pixelX = Math.floor(x / rect.width * width);
  var pixelY = Math.floor(y / rect.height * height);

  changeColor(pixelX, pixelY);

}

