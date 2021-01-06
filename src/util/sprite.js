import * as echarts from 'echarts/lib/echarts';

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

    path.x = margin.left;
    path.y = margin.top;
    if (width > height) {
        path.y += (size - height) / 2;
    }
    else {
        path.x += (size - width) / 2;
    }

    var rect = path.getBoundingRect();
    path.x -= rect.x;
    path.y -= rect.y;

    path.setStyle(style);

    path.update();

    path.__size = size;

    return path;
}

    // http://www.valvesoftware.com/publications/2007/SIGGRAPH2007_AlphaTestedMagnification.pdf
function generateSDF(ctx, sourceImageData, range) {

    var sourceWidth = sourceImageData.width;
    var sourceHeight = sourceImageData.height;

    var width = ctx.canvas.width;
    var height = ctx.canvas.height;

    var scaleX = sourceWidth / width;
    var scaleY = sourceHeight / height;

    function sign(r) {
        return r < 128 ? 1 : -1;
    }
    function searchMinDistance(x, y) {
        var minDistSqr = Infinity;
        x = Math.floor(x * scaleX);
        y = Math.floor(y * scaleY);
        var i = y * sourceWidth + x;
        var r = sourceImageData.data[i * 4];
        var a = sign(r);
        // Search for min distance
        for (var y2 = Math.max(y - range, 0); y2 < Math.min(y + range, sourceHeight); y2++) {
            for (var x2 = Math.max(x - range, 0); x2 < Math.min(x + range, sourceWidth); x2++) {
                var i = y2 * sourceWidth + x2;
                var r2 = sourceImageData.data[i * 4];
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
        return a * Math.sqrt(minDistSqr);
    }

    var sdfImageData = ctx.createImageData(width, height);
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            var dist = searchMinDistance(x, y);

            var normalized = dist / range * 0.5 + 0.5;
            var i = (y * width + x) * 4;
            sdfImageData.data[i++] = (1.0 - normalized) * 255;
            sdfImageData.data[i++] = (1.0 - normalized) * 255;
            sdfImageData.data[i++] = (1.0 - normalized) * 255;
            sdfImageData.data[i++] = 255;
        }
    }

    return sdfImageData;
}

var spriteUtil = {

    getMarginByStyle: function (style) {
        var minMargin = style.minMargin || 0;

        var lineWidth = 0;
        if (style.stroke && style.stroke !== 'none') {
            lineWidth = style.lineWidth == null ? 1 : style.lineWidth;
        }
        var shadowBlurSize = style.shadowBlur || 0;
        var shadowOffsetX = style.shadowOffsetX || 0;
        var shadowOffsetY = style.shadowOffsetY || 0;

        var margin = {};
        margin.left = Math.max(lineWidth / 2, -shadowOffsetX + shadowBlurSize, minMargin);
        margin.right = Math.max(lineWidth / 2, shadowOffsetX + shadowBlurSize, minMargin);
        margin.top = Math.max(lineWidth / 2, -shadowOffsetY + shadowBlurSize, minMargin);
        margin.bottom = Math.max(lineWidth / 2, shadowOffsetY + shadowBlurSize, minMargin);

        return margin;
    },

    // TODO Not consider shadowOffsetX, shadowOffsetY.
    /**
     * @param {string} symbol
     * @param {number | Array.<number>} symbolSize
     * @param {Object} style
     */
    createSymbolSprite: function (symbol, symbolSize, style, canvas) {
        var path = makePath(symbol, symbolSize, style);

        var margin = spriteUtil.getMarginByStyle(style);

        return {
            image: makeSprite(path.__size, canvas, function (ctx) {
                echarts.innerDrawElementOnCanvas(ctx, path);
            }),
            margin: margin
        };
    },

    createSDFFromCanvas: function (canvas, size, range, outCanvas) {
        // TODO Create a low resolution SDF from high resolution image.
        return makeSprite(size, outCanvas, function (outCtx) {
            var ctx = canvas.getContext('2d');
            var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            outCtx.putImageData(generateSDF(outCtx, imgData, range), 0, 0);
        });
    },

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

export default spriteUtil;