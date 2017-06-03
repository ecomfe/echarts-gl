module.exports = {
    defaultOption: {

        viewControl: {
            // If rotate on on init
            autoRotate: false,
            // cw or ccw
            autoRotateDirection: 'cw',
            // Degree per second
            autoRotateSpeed: 10,

            // Start rotating after still for a given time
            // default is 3 seconds
            autoRotateAfterStill: 3,

            // Rotate, zoom damping.
            damping: 0.8,

            rotateSensitivity: 1,
            zoomSensitivity: 1,
            panSensitivity: 1,

            distance: 150,

            minDistance: 40,

            maxDistance: 400,

            // Center view point
            center: [0, 0, 0],
            // Alpha angle for top-down rotation
            // Positive to rotate to top.
            alpha: 0,
            // beta angle for left-right rotation
            // Positive to rotate to right.
            beta: 0,

            minAlpha: -90,
            maxAlpha: 90

            // minBeta: -Infinity
            // maxBeta: -Infinity
        }
    },

    setView: function (opts) {
        opts = opts || {};
        this.option.viewControl = this.option.viewControl || {};
        if (opts.alpha != null) {
            this.option.viewControl.alpha = opts.alpha;
        }
        if (opts.beta != null) {
            this.option.viewControl.beta = opts.beta;
        }
        if (opts.distance != null) {
            this.option.viewControl.distance = opts.distance;
        }
        if (opts.center != null) {
            this.option.viewControl.center = opts.center;
        }
    }
};