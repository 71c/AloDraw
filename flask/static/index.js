var socket;

var canvas = document.createElement('canvas');
canvas.onclick = getMousePosition;

var ctx;

var image = new Image;

var width;
var height;

var zoomLevel = 1;


document.addEventListener('DOMContentLoaded', () => {
  socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

  socket.emit('request image');
  socket.on('send image', data => {
    width = data.width;
    height = data.height;

    var buffer = new Uint8ClampedArray(data.buffer);

    ctx = canvas.getContext('2d');

    canvas.width = width;
    canvas.height = height;

    var idata = ctx.createImageData(width, height);
    idata.data.set(buffer);
    ctx.putImageData(idata, 0, 0);

    image.src = canvas.toDataURL();

    ctx.drawImage(image,0,0);
    document.body.append(canvas);


    // var slider = document.getElementById('customRange2');
    // setInterval(() => {
    //   canvas.style.width = slider.value + 'px';
    //   canvas.style.height = slider.value + 'px';
    //   // canvas.width = slider.value + '';
    //   // canvas.height = slider.value + '';
    // }, 100);

    document.getElementById('zoom-in').onclick = function() {
      zoomLevel++;
      canvas.style.width = zoomLevel * width + 'px';
      canvas.style.height = zoomLevel * height + 'px';
    };

    document.getElementById('zoom-out').onclick = function() {
      zoomLevel--;
      canvas.style.width = zoomLevel * width + 'px';
      canvas.style.height = zoomLevel * height + 'px';
    };

  });


  socket.on('broadcast change pixel', data => {

    console.log('i got changed pixel');

    var imgData = ctx.getImageData(0,0,canvas.width,canvas.height);

    var index = data.index;

    imgData.data[index] = data.color[0];
    imgData.data[index + 1] = data.color[1];
    imgData.data[index + 2] = data.color[2];

    ctx.putImageData(imgData, 0, 0);



    // var changedPixel = document.querySelector('[x="' + data.x + '"][y="' + data.y + '"]');
    // changedPixel.style.backgroundColor = 'rgb(' + data.color[0] + ', ' + data.color[1] + ', ' + data.color[2] + ')';

  });


});

function changeColor(x, y) {
  socket.emit('change pixel', {
    'color': 'rgb(0,0,0)',
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