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
        makeSpriteFromShape: function (size, shape, inCanvas) {
            // Fit to the canvas
            var rect = shape.getRect(shape.style);
            var lineWidth = shape.style.lineWidth || 0;
            var shadowBlur = shape.style.shadowBlur || 0;
            var margin = lineWidth + shadowBlur;
            rect.x -= margin;
            rect.y -= margin;
            rect.width += margin * 2;
            rect.height += margin * 2;
            var scaleX = size / rect.width;
            var scaleY = size / rect.height;
            var x = rect.x;
            var y = rect.y;
            shape.position = [-rect.x * scaleX, -rect.y * scaleY];
            shape.scale = [scaleX, scaleY];
            shape.updateTransform();

            return makeSprite(size, inCanvas, function (ctx) {
                shape.brush(ctx);
            });
        },

        makeSimpleSprite: function (size, inCanvas) {
            return makeSprite(size, inCanvas, function (ctx) {
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

    return spriteUtil;
});