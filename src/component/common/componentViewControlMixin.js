module.exports = {
    defaultOption: {

        viewControl: {
            // If rotate on on init
            autoRotate: false,

            // Rotate, zoom damping.
            damping: 0.8,

            // Start rotating after still for a given time
            // default is 3 seconds
            autoRotateAfterStill: 3,

            // Distance to the surface of globe.
            distance: 150,

            // Min distance to the surface of globe
            minDistance: 40,
            // Max distance to the surface of globe
            maxDistance: 400,

            // Alpha angle for top-down rotation
            // Positive to rotate to top.
            alpha: 0,
            // beta angle for left-right rotation
            // Positive to rotate to right.
            beta: 0,

            minAlpha: -90,
            maxAlpha: 90
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