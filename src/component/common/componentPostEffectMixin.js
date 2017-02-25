module.exports = {
    defaultOption: {
        // Post effect
        postEffect: {
            enable: false,

            bloom: {
                enable: true,
                intensity: 0.1
            },
            // depthOfField: {
            //     enable: false
            // },
            FXAA: {
                enable: false
            }
        },

        // Temporal super sampling when the picture is still.
        temporalSuperSampling: {
            enable: true
        }
    }
};