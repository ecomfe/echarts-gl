var spriteUtil = require('../../src/util/sprite');
var fs = require('fs');

var Canvas = require('canvas');

var canvas = new Canvas(50, 50);
spriteUtil.createSymbolStrokeSDF('circle', 50, 20, {
    // Must have stroke.
    stroke: '#fff',
    lineWidth: 2
}, canvas);

fs.writeFile('sdf.png', canvas.toBuffer());
