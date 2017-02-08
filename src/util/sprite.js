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

var spriteUtil = {

    getMarginByStyle: function (style) {
        var lineWidth = 0;
        if (style.stroke && style.stroke !== 'none') {
            lineWidth = style.lineWidth == null ? 1 : style.lineWidth;
        }
        var shadowBlurSize = style.shadowBlur || 0;
        var shadowOffsetX = style.shadowOffsetX || 0;
        var shadowOffsetY = style.shadowOffsetY || 0;

        var margin = {};
        margin.left = Math.max(lineWidth / 2, -shadowOffsetX + shadowBlurSize);
        margin.right = Math.max(lineWidth / 2, shadowOffsetX + shadowBlurSize);
        margin.top = Math.max(lineWidth / 2, -shadowOffsetY + shadowBlurSize);
        margin.bottom = Math.max(lineWidth / 2, shadowOffsetY + shadowBlurSize);

        return margin;
    },
    /**
     * @param {string} symbol
     * @param {number | Array.<number>} symbolSize
     */
    createSymbolSprite: function (symbol, symbolSize, style, canvas) {
        if (!echarts.util.isArray(symbolSize)) {
            symbolSize = [symbolSize, symbolSize];
        }
        var margin = spriteUtil.getMarginByStyle(style);
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

        return {
            image: makeSprite(size, canvas, function (ctx) {
                path.brush(ctx);
            }),
            margin: margin
        };
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

module.exports = spriteUtil;