var fs = require('fs');

var Canvas = require('canvas');

require('zrender/lib/core/util').createCanvas = function () {
    return new Canvas(128, 128);
};
var Surface = require('../../src/util/ZRTextureAtlasSurface');
var echarts = require('echarts');

global.document = {
    createElement: function () {
        return new Canvas(50, 50);
    }
};

var surface = new Surface({
    width: 128,
    height: 128,
    devicePixelRatio: 1
});

for (var i = 0; i < 2000; i++) {
    var circle = new echarts.graphic.Circle({
        shape: {
            cx: 10,
            cy: 10,
            r: 10
        },
        fill: '#000'
    });
    surface.add(circle);
}

surface.getZr().refreshImmediately();

fs.writeFile('surface.png', surface.getTexture().image.toBuffer());

surface.getZr().dispose();
