export default {
    defaultOption: {
        // Post effect
        postEffect: {
            enable: false,

            bloom: {
                enable: true,
                intensity: 0.1
            },
            depthOfField: {
                enable: false,
                focalRange: 20,
                focalDistance: 50,
                blurRadius: 10,
                fstop: 2.8,
                quality: 'medium'
            },

            screenSpaceAmbientOcclusion: {
                enable: false,
                radius: 2,
                // low, medium, high, ultra
                quality: 'medium',
                intensity: 1
            },

            screenSpaceReflection: {
                enable: false,
                quality: 'medium',
                maxRoughness: 0.8
            },

            colorCorrection: {
                enable: true,

                exposure: 0,

                brightness: 0,

                contrast: 1,

                saturation: 1,

                lookupTexture: ''
            },

            edge: {
                enable: false
            },

            FXAA: {
                enable: false
            }
        },

        // Temporal super sampling when the picture is still.
        temporalSuperSampling: {
            // Only enabled when postEffect is enabled
            enable: 'auto'
        }
    }
};