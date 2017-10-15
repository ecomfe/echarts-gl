export default {
    defaultOption: {

        viewControl: {
            // perspective, orthographic.
            // TODO Isometric
            projection: 'perspective',
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
            // Sensitivities for operations.
            // Can be array to set x,y respectively
            rotateSensitivity: 1,
            zoomSensitivity: 1,
            // Can be array to set x,y respectively
            panSensitivity: 1,
            // Which mouse button do rotate or pan
            panMouseButton: 'middle',
            rotateMouseButton: 'left',

            // Distance to the target
            // Only available when camera is perspective.
            distance: 150,
            // Min distance mouse can zoom in
            minDistance: 40,
            // Max distance mouse can zoom out
            maxDistance: 400,

            // Size of viewing volume.
            // Only available when camera is orthographic
            orthographicSize: 150,
            maxOrthographicSize: 400,
            minOrthographicSize: 20,

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