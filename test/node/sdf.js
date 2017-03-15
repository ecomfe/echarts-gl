var spriteUtil = require('../../src/util/sprite');
var fs = require('fs');

var Canvas = require('canvas');

var canvas = new Canvas(100, 100);
var sdfCanvas = new Canvas(22, 22);
spriteUtil.createSymbolSprite('circle', 100, {
    fill: '#fff'
}, canvas);
spriteUtil.createSDFFromCanvas(canvas, 10, 10, sdfCanvas);

fs.writeFile('sdf.png', sdfCanvas.toBuffer());
