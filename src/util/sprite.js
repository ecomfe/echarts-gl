var echarts = require('echarts/lib/echarts');

function makeSprite(size, canvas, draw) {
    // http://simonsarris.com/blog/346-how-you-clear-your-canvas-matters
    // http://jsperf.com/canvasclear
    // Set width and height is fast
    // And use the exist canvas if possible
    // http://jsperf.com/create-canvas-vs-set-width-height/2
    var canvas = canvas || document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');

    draw && draw(ctx);

    return canvas;
}

function makePath(symbol, symbolSize, style, marginBias) {
    if (!echarts.util.isArray(symbolSize)) {
        symbolSize = [symbolSize, symbolSize];
    }
    var margin = spriteUtil.getMarginByStyle(style, marginBias);
    var width = symbolSize[0] + margin.left + margin.right;
    var height = symbolSize[1] + margin.top + margin.bottom;
    var path = echarts.helper.createSymbol(symbol, 0, 0, symbolSize[0], symbolSize[1]);

    var size = Math.max(width, height);

    path.position = [margin.left, margin.top];
    if (width > height) {
        path.position[1] += (size - height) / 2;
    }
    else {
        path.position[0] += (size - width) / 2;
    }

    var rect = path.getBoundingRect();
    path.position[0] -= rect.x;
    path.position[1] -= rect.y;

    path.setStyle(style);

    path.update();

    path.__size = size;

    return path;
}

    // http://www.valvesoftware.com/publications/2007/SIGGRAPH2007_AlphaTestedMagnification.pdf
function generateSDF(ctx, imgData, range) {

    var width = imgData.width;
    var height = imgData.height;

    function sign(r) {
        return r < 128 ? 1 : -1;
    }
    function searchMinDistance(x, y, r) {
        var a = sign(r);
        var minDistSqr = Infinity;
        // Search for min distance
        for (var y2 = Math.max(y - range, 0); y2 < Math.min(y + range, height); y2++) {
            for (var x2 = Math.max(x - range, 0); x2 < Math.min(x + range, width); x2++) {
                var i = y2 * width + x2;
                var r2 = imgData.data[i * 4];
                var b = sign(r2);
                var dx = x2 - x;
                var dy = y2 - y;
                if (a !== b) {
                    var distSqr = dx * dx + dy * dy;
                    if (distSqr < minDistSqr) {
                        minDistSqr = distSqr;
                    }
                }
            }
        }
        return a * minDistSqr;
    }

    var sdfImageData = ctx.createImageData(width, height);
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            var i = (y * width + x) * 4;
            var r = imgData.data[i];

            var dist = searchMinDistance(x, y, r);

            var normalized = dist / range / 1.41 * 0.5 + 0.5;
            sdfImageData.data[i++] = (1.0 - normalized) * 255;
            sdfImageData.data[i++] = (1.0 - normalized) * 255;
            sdfImageData.data[i++] = (1.0 - normalized) * 255;
            sdfImageData.data[i++] = 255;
        }
    }

    return sdfImageData;
}

var spriteUtil = {

    getMarginByStyle: function (style, marginBias) {
        marginBias = marginBias || 0;

        var lineWidth = 0;
        if (style.stroke && style.stroke !== 'none') {
            lineWidth = style.lineWidth == null ? 1 : style.lineWidth;
        }
        var shadowBlurSize = style.shadowBlur || 0;
        var shadowOffsetX = style.shadowOffsetX || 0;
        var shadowOffsetY = style.shadowOffsetY || 0;

        var margin = {};
        margin.left = Math.max(lineWidth / 2, -shadowOffsetX + shadowBlurSize) + marginBias;
        margin.right = Math.max(lineWidth / 2, shadowOffsetX + shadowBlurSize) + marginBias;
        margin.top = Math.max(lineWidth / 2, -shadowOffsetY + shadowBlurSize) + marginBias;
        margin.bottom = Math.max(lineWidth / 2, shadowOffsetY + shadowBlurSize) + marginBias;

        return margin;
    },

    // TODO Not consider shadowOffsetX, shadowOffsetY.
    /**
     * @param {string} symbol
     * @param {number | Array.<number>} symbolSize
     */
    createSymbolSprite: function (symbol, symbolSize, style, canvas) {
        // TODO marginBias can be set.
        var path = makePath(symbol, symbolSize, style);

        var margin = spriteUtil.getMarginByStyle(style);

        return {
            image: makeSprite(path.__size, canvas, function (ctx) {
                path.brush(ctx);
            }),
            margin: margin
        };
    },

    createSymbolSDF: function (symbol, symbolSize, range, style, canvas) {
        // TODO Create a low resolution SDF from high resolution image.
        var pathEl = makePath(symbol, symbolSize, style, 10);

        pathEl.setStyle({
            fill: '#fff',
            stroke: 'transparent',
            shadowColor: 'transparent'
        });
        return makeSprite(pathEl.__size, canvas, function (ctx) {
            pathEl.brush(ctx);
            var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            ctx.putImageData(generateSDF(ctx, imgData, range), 0, 0);
        });
    },

    // createSymbolStrokeSDF: function (symbol, symbolSize, range, style, canvas) {
    //     var pathEl = makePath(symbol, symbolSize, style);

    //     pathEl.setStyle({
    //         stroke: '#fff',
    //         lineWidth: style.lineWidth,
    //         fill: 'transparent',
    //         shadowColor: 'transparent'
    //     });
    //     return makeSprite(pathEl.__size, canvas, function (ctx) {
    //         pathEl.brush(ctx);
    //         var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    //         ctx.putImageData(generateSDF(ctx, imgData, range), 0, 0);
    //     });
    // },

    createSimpleSprite: function (size, canvas) {
        return makeSprite(size, canvas, function (ctx) {
            var halfSize = size / 2;
            ctx.beginPath();
            ctx.arc(halfSize, halfSize, 60, 0, Math.PI * 2, false) ;
            ctx.closePath();

            var gradient = ctx.createRadialGradient(
                halfSize, halfSize, 0, halfSize, halfSize, halfSize
            );
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.fill();
        });
    }
};

module.exports = spriteUtil;