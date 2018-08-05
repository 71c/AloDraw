var socket;
var zoomLevel = 4;
document.addEventListener('DOMContentLoaded', () => {
  socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);



  document.querySelector('#zoom-in').setAttribute('onclick', "zoomIn()");
  document.querySelector('#zoom-out').setAttribute('onclick', "zoomOut()");

  socket.emit('request image');
  var image;
  socket.on('send image', data => {
    // var canvas = document.getElementById('canvas');
    // canvas.setAttribute('width', data.width);
    // canvas.setAttribute('height', data.height);

    // ctx = canvas.getContext('2d');



    // var el = document.createElement('img');
    // // el.src = 'data:image/jpeg;base64,' + data.buffer.toString('base64');
    // // document.body.append(el);
    // // ctx.drawImage(el, 0, 0);


    // var b64encoded = btoa(String.fromCharCode.apply(null, data.buffer));
    // var datajpg = "data:image/jpg;base64," + b64encoded;
    // el.src = datajpg;

    // document.body.append(el);





    // var blob = new Blob(data.buffer, {type: 'image/png'});
    // var url = URL.createObjectURL(blob);
    // var img = new Image;
    // img.onload = function() {
    //     var ctx = document.getElementById("canvas").getContext('2d');
    //     ctx.drawImage(this, 0, 0);
    //     URL.revokeObjectURL(url);
    // };
    // img.src = url;



    // console.log(data.buffer);
    // image = new Image();
    // // image.src = 'data:image/jpeg;base64,' + data.buffer;

    // var imageData = ctx.createImageData(300, 300);
    // imageData.data.set(data.buffer);

    // // console.log(imageData.data);
    // image.src = imageData;
    // ctx.drawImage(image, 0, 0);

    // ctx.putImageData(data.buffer.Uint8Array, 300, 300);
    // ctx.createImageData(new ImageData(data.buffer.Uint8Array, [300, 300]));

    // ctx.drawImage(image, 0, 0);






    image = new Uint8Array(data.buffer);
    console.log(image);



    var width = data.width;
    var height = data.height;

    var table = document.createElement('table');


    let i = 0;
    for (let row = 0; row < height; row++) {
      let tableRow = document.createElement('tr');
      for (let col = 0; col < width; col++) {
        var pixel = document.createElement('div');

        var red = image[i];
        i++;
        var green = image[i];
        i++;
        var blue = image[i];
        i++;
        i++;

        pixel.setAttribute('style', 'background-color:rgb(' + red + ',' + green + ',' + blue + ');width:4px;height:4px;');
        pixel.setAttribute('x', col);
        pixel.setAttribute('y', row);

        pixel.setAttribute('onclick', 'changeColor(this);');

        let tableCol = document.createElement('td');

        tableCol.append(pixel);


        tableRow.append(tableCol);


      }
      table.append(tableRow);
    }
    document.body.append(table);
  });


  socket.on('broadcast change pixel', data => {

    console.log('i got changed pixel');

    var changedPixel = document.querySelector('[x="' + data.x + '"][y="' + data.y + '"]');
    changedPixel.style.backgroundColor = 'rgb(' + data.color[0] + ', ' + data.color[1] + ', ' + data.color[2] + ')';

    // $('[x="' + data.x + '"][y="' + data.y + '"]').css('background-color', 'rgb(' + data.color[0] + ', ' + data.color[1] + ', ' + data.color[2] + ')');
    // changedPixel.css('background-color', 'rgb(' + data.color[0] + ', ' + data.color[1] + ', ' + data.color[2] + ')');
  });


});

function changeColor(element) {
  element.setAttribute('style', 'background-color:rgb(1,2,3);width:' + getZoomLevel() + ';height:' + getZoomLevel() + ';');
  var color = window.getComputedStyle(element).backgroundColor;

  socket.emit('change pixel', {
    'color': color,
    'x': element.getAttribute('x'),
    'y': element.getAttribute('y')
  });
}

function zoomIn() {
  zoomLevel++;
  zoom();
}

function zoomOut() {
  zoomLevel--;
  zoom();
}

function zoom() {
  var pixels = document.querySelectorAll('div');
  console.log(pixels);
  pixels.forEach(pixel => {
    pixel.style.width = getZoomLevel();
    pixel.style.height = getZoomLevel();
  });
}

function getZoomLevel() {
  return zoomLevel + 'px';
}