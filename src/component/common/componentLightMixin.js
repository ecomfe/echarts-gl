export default {
    defaultOption: {
        // Light is available when material.shading is not color
        light: {
            // Main light
            main: {
                shadow: false,
                // low, medium, high, ultra
                shadowQuality: 'high',

                color: '#fff',
                intensity: 1,

                alpha: 0,
                beta: 0
            },
            ambient: {
                color: '#fff',
                intensity: 0.2
            },
            ambientCubemap: {
                // Panorama environment texture,
                // Support .hdr and commmon web formats.
                texture: null,
                // Available when texture is hdr.
                exposure: 1,
                // Intensity for diffuse term
                diffuseIntensity: 0.5,
                // Intensity for specular term, only available when shading is realastic
                specularIntensity: 0.5
            }
        }
    }
};