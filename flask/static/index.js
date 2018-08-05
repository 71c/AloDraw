var resize = function( img, scale ) {
    // Takes an image and a scaling factor and returns the scaled image

    // The original image is drawn into an offscreen canvas of the same size
    // and copied, pixel by pixel into another offscreen canvas with the
    // new size.

    var widthScaled = img.width * scale;
    var heightScaled = img.height * scale;

    var orig = document.createElement('canvas');
    orig.width = img.width;
    orig.height = img.height;
    var origCtx = orig.getContext('2d');
    origCtx.drawImage(img, 0, 0);
    var origPixels = origCtx.getImageData(0, 0, img.width, img.height);

    var scaled = document.createElement('canvas');
    scaled.width = widthScaled;
    scaled.height = heightScaled;
    var scaledCtx = scaled.getContext('2d');
    var scaledPixels = scaledCtx.getImageData( 0, 0, widthScaled, heightScaled );

    for( var y = 0; y < heightScaled; y++ ) {
        for( var x = 0; x < widthScaled; x++ ) {
            var index = (Math.floor(y / scale) * img.width + Math.floor(x / scale)) * 4;
            var indexScaled = (y * widthScaled + x) * 4;
            scaledPixels.data[ indexScaled ] = origPixels.data[ index ];
            scaledPixels.data[ indexScaled+1 ] = origPixels.data[ index+1 ];
            scaledPixels.data[ indexScaled+2 ] = origPixels.data[ index+2 ];
            scaledPixels.data[ indexScaled+3 ] = origPixels.data[ index+3 ];
        }
    }
    scaledCtx.putImageData( scaledPixels, 0, 0 );
    return scaled;
};



var socket;
var zoomLevel = 300;

var canvas = document.createElement('canvas');
canvas.imageSmoothingEnabled = false;




var image = new Image;

document.addEventListener('DOMContentLoaded', () => {
  socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);



  // document.querySelector('#zoom-in').setAttribute('onclick', "zoomIn()");
  // document.querySelector('#zoom-out').setAttribute('onclick', "zoomOut()");

  socket.emit('request image');
  socket.on('send image', data => {
    var width = data.width;
    var height = data.height;

    var buffer = new Uint8ClampedArray(data.buffer);


    var ctx = canvas.getContext('2d');

    // ctx.webkitImageSmoothingEnabled=false;
    // ctx.mozImageSmoothingEnabled = false;

    canvas.width = width;
    canvas.height = height;

    var idata = ctx.createImageData(width, height);
    idata.data.set(buffer);
    ctx.putImageData(idata, 0, 0);

    image.src = canvas.toDataURL();
    // document.body.appendChild(image);

    // image = resize(image, 3);



    ctx.drawImage(image,0,0);
    document.body.append(canvas);

    document.body.append(image);

    // var dataUri = canvas.toDataURL();
    // image.src = dataUri;

    // document.body.append(canvas);







    // var did = document.createElement('div');
    // did.setAttribute('class', 'flex-container');

    // var table = document.createElement('table');

    // let i = 0;
    // for (let row = 0; row < height; row++) {
    //   let tableRow = document.createElement('tr');
    //   for (let col = 0; col < width; col++) {
    //     var pixel = document.createElement('div');

    //     var red = buffer[i];
    //     i++;
    //     var green = buffer[i];
    //     i++;
    //     var blue = buffer[i];
    //     i++;
    //     i++;

    //     pixel.setAttribute('style', 'background-color:rgb(' + red + ',' + green + ',' + blue + ');width:4px;height:4px;');
    //     pixel.setAttribute('x', col);
    //     pixel.setAttribute('y', row);

    //     pixel.setAttribute('onclick', 'changeColor(this);');

    //     let tableCol = document.createElement('td');

    //     tableCol.append(pixel);


    //     tableRow.append(tableCol);


    //   }
    //   table.append(tableRow);
    // }

    // did.append(table);
    // document.body.append(did);
  });


  socket.on('broadcast change pixel', data => {

    console.log('i got changed pixel');

    var changedPixel = document.querySelector('[x="' + data.x + '"][y="' + data.y + '"]');
    changedPixel.style.backgroundColor = 'rgb(' + data.color[0] + ', ' + data.color[1] + ', ' + data.color[2] + ')';

  });

  var slider = document.getElementById('customRange2');
  setInterval(() => {
    console.log(slider.value);
    canvas.style.width = slider.value + 'px';
    canvas.style.height = slider.value + 'px';
  }, 100);
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



// function zoomIn() {
//   // zoomLevel += 10;
//   zoomLevel *= 1.4142135624;

//   zoom();
// }

// function zoomOut() {
//   // zoomLevel -= 10;
//   zoomLevel /= 1.4142135624;
//   zoom();
// }

// function zoom() {
//   // var pixels = document.querySelectorAll('div');
//   // console.log(pixels);
//   // pixels.forEach(pixel => {
//   //   pixel.style.width = getZoomLevel();
//   //   pixel.style.height = getZoomLevel();
//   // });

//   canvas.style.width = getZoomLevel();
//   canvas.style.height = getZoomLevel();
// }

function getZoomLevel() {
  return zoomLevel + 'px';
}


// window.onload = function() {
//   var ctx = canvas.getContext('2d');
//   trackTransforms(ctx);
//   function redraw() {
//     // Clear the entire canvas
//     var p1 = ctx.transformedPoint(0, 0);
//     var p2 = ctx.transformedPoint(canvas.width, canvas.height);
//     ctx.clearRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);

//     ctx.save();
//     ctx.setTransform(1, 0, 0, 1, 0, 0);
//     ctx.clearRect(0, 0, canvas.width, canvas.height);
//     ctx.restore();

//     ctx.drawImage(image, 0, 0);
//   }
//   redraw();

//   var lastX = canvas.width / 2,
//     lastY = canvas.height / 2;

//   var dragStart, dragged;

//   canvas.addEventListener('mousedown', function(evt) {
//     document.body.style.mozUserSelect = document.body.style.webkitUserSelect = document.body.style.userSelect = 'none';
//     lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
//     lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
//     dragStart = ctx.transformedPoint(lastX, lastY);
//     dragged = false;
//   }, false);

//   canvas.addEventListener('mousemove', function(evt) {
//     lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
//     lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
//     dragged = true;
//     if (dragStart) {
//       var pt = ctx.transformedPoint(lastX, lastY);
//       ctx.translate(pt.x - dragStart.x, pt.y - dragStart.y);
//       redraw();
//     }
//   }, false);

//   canvas.addEventListener('mouseup', function(evt) {
//     dragStart = null;
//   }, false);


//   var scaleFactor = 1.1;

//   var zoom = function(clicks) {
//     var pt = ctx.transformedPoint(lastX, lastY);
//     ctx.translate(pt.x, pt.y);
//     var factor = Math.pow(scaleFactor, clicks);
//     ctx.scale(factor, factor);
//     ctx.translate(-pt.x, -pt.y);
//     redraw();
//   };

//   var handleScroll = function(evt) {
//     var delta = evt.wheelDelta ? evt.wheelDelta / 40 : evt.detail ? -evt.detail : 0;
//     if (delta) zoom(delta);
//     return evt.preventDefault() && false;
//   };

//   canvas.addEventListener('DOMMouseScroll', handleScroll, false);
//   canvas.addEventListener('mousewheel', handleScroll, false);
// }









// function trackTransforms(ctx){
//     var svg = document.createElementNS("http://www.w3.org/2000/svg",'svg');
//     var xform = svg.createSVGMatrix();
//     ctx.getTransform = function(){ return xform; };

//     var savedTransforms = [];
//     var save = ctx.save;
//     ctx.save = function(){
//         savedTransforms.push(xform.translate(0,0));
//         return save.call(ctx);
//     };

//     var restore = ctx.restore;
//     ctx.restore = function(){
//       xform = savedTransforms.pop();
//       return restore.call(ctx);
// 	      };

//     var scale = ctx.scale;
//     ctx.scale = function(sx,sy){
//       xform = xform.scaleNonUniform(sx,sy);
//       return scale.call(ctx,sx,sy);
// 	      };

//     var rotate = ctx.rotate;
//     ctx.imageSmoothingEnabled = false;
//     ctx.rotate = function(radians){
//         xform = xform.rotate(radians*180/Math.PI);
//         return rotate.call(ctx,radians);
//     };

//     var translate = ctx.translate;
//     ctx.translate = function(dx,dy){
//         xform = xform.translate(dx,dy);
//         return translate.call(ctx,dx,dy);
//     };

//     var transform = ctx.transform;
//     ctx.transform = function(a,b,c,d,e,f){
//         var m2 = svg.createSVGMatrix();
//         m2.a=a; m2.b=b; m2.c=c; m2.d=d; m2.e=e; m2.f=f;
//         xform = xform.multiply(m2);
//         return transform.call(ctx,a,b,c,d,e,f);
//     };

//     var setTransform = ctx.setTransform;
//     ctx.setTransform = function(a,b,c,d,e,f){
//         xform.a = a;
//         xform.b = b;
//         xform.c = c;
//         xform.d = d;
//         xform.e = e;
//         xform.f = f;
//         return setTransform.call(ctx,a,b,c,d,e,f);
//     };

//     var pt  = svg.createSVGPoint();
//     ctx.transformedPoint = function(x,y){
//         pt.x=x; pt.y=y;
//         return pt.matrixTransform(xform.inverse());
//     }
// }

