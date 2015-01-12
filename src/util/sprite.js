define(function (require) {
    function makeSprite(size, inCanvas, draw) {
        // http://simonsarris.com/blog/346-how-you-clear-your-canvas-matters
        // http://jsperf.com/canvasclear
        // Set width and height is fast
        // And use the exist canvas if possible
        // http://jsperf.com/create-canvas-vs-set-width-height/2
        var canvas = inCanvas || document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');

        draw && draw(ctx);

        return canvas;
    }

    var spriteUtil = {
        makeCircle: function (style, inCanvas) {
            var size = style.size;
            return makeSprite(size, inCanvas, function (ctx) {
                ctx.fillStyle = style.color || 'white';
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    };

    return spriteUtil;
});