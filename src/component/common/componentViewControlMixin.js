module.exports = {
    defaultOption: {

        viewControl: {
            // If rotate on on init
            autoRotate: false,

            // Rotate, zoom damping.
            damping: 0.8,

            rotateSensitivity: 1,
            zoomSensitivity: 1,

            // Start rotating after still for a given time
            // default is 3 seconds
            autoRotateAfterStill: 3,

            distance: 150,

            minDistance: 40,

            maxDistance: 400,

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
    }
};