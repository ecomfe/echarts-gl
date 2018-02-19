@export ecgl.dof.coc

uniform sampler2D depth;

uniform float zNear: 0.1;
uniform float zFar: 2000;

uniform float focalDistance: 3;
// Object in range are perfectly in focus
uniform float focalRange: 1;
// 30mm
uniform float focalLength: 30;
// f/2.8
uniform float fstop: 2.8;

varying vec2 v_Texcoord;

@import clay.util.encode_float

void main()
{
    float z = texture2D(depth, v_Texcoord).r * 2.0 - 1.0;

    float dist = 2.0 * zNear * zFar / (zFar + zNear - z * (zFar - zNear));

    float aperture = focalLength / fstop;

    float coc;

    float uppper = focalDistance + focalRange;
    float lower = focalDistance - focalRange;
    if (dist <= uppper && dist >= lower) {
        // Object in range are perfectly in focus
        coc = 0.5;
    }
    else {
        // Adjust focalDistance
        float focalAdjusted = dist > uppper ? uppper : lower;

        // GPU Gems Depth of Field: A Survey of Techniques
        coc = abs(aperture * (focalLength * (dist - focalAdjusted)) / (dist * (focalAdjusted - focalLength)));
        // Clamp on the near focus plane and far focus plane
        // PENDING
        // Float value can only be [0.0 - 1.0)
        coc = clamp(coc, 0.0, 2.0) / 2.00001;

        // Near field
        if (dist < lower) {
            coc = -coc;
        }
        coc = coc * 0.5 + 0.5;
    }

    // R: coc, < 0.5 is near field, > 0.5 is far field
    gl_FragColor = encodeFloat(coc);
}
@end


@export ecgl.dof.composite

#define DEBUG 0

uniform sampler2D original;
uniform sampler2D blurred;
uniform sampler2D nearfield;
uniform sampler2D coc;
uniform sampler2D nearcoc;
varying vec2 v_Texcoord;

@import clay.util.rgbm
@import clay.util.float

void main()
{
    vec4 blurredColor = texture2D(blurred, v_Texcoord);
    vec4 originalColor = texture2D(original, v_Texcoord);

    float fCoc = decodeFloat(texture2D(coc, v_Texcoord));

    // FIXME blur after premultiply will have white edge
    // blurredColor.rgb /= max(fCoc, 0.1);
    fCoc = abs(fCoc * 2.0 - 1.0);

    float weight = smoothstep(0.0, 1.0, fCoc);
    // float weight = fCoc;

#ifdef NEARFIELD_ENABLED
    vec4 nearfieldColor = texture2D(nearfield, v_Texcoord);
    float fNearCoc = decodeFloat(texture2D(nearcoc, v_Texcoord));
    fNearCoc = abs(fNearCoc * 2.0 - 1.0);

    // FIXME
    gl_FragColor = encodeHDR(
        mix(
            nearfieldColor, mix(originalColor, blurredColor, weight),
            // near field blur is too unobvious if use linear blending
            pow(1.0 - fNearCoc, 4.0)
        )
    );
#else
    gl_FragColor = encodeHDR(mix(originalColor, blurredColor, weight));
#endif

// #if DEBUG == 1
//     // Show coc
//     gl_FragColor = vec4(vec3(fCoc), 1.0);
// #elif DEBUG == 2
//     // Show near coc
//     gl_FragColor = vec4(vec3(fNearCoc), 1.0);
// #elif DEBUG == 3
//     gl_FragColor = encodeHDR(blurredColor);
// #elif DEBUG == 4
//     // gl_FragColor = vec4(vec3(nearfieldTexel.a), 1.0);
//     gl_FragColor = encodeHDR(nearfieldColor);
// #endif
}

@end



@export ecgl.dof.diskBlur

#define POISSON_KERNEL_SIZE 16;

uniform sampler2D texture;
uniform sampler2D coc;
varying vec2 v_Texcoord;

uniform float blurRadius : 10.0;
uniform vec2 textureSize : [512.0, 512.0];

uniform vec2 poissonKernel[POISSON_KERNEL_SIZE];

uniform float percent;

float nrand(const in vec2 n) {
    return fract(sin(dot(n.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

@import clay.util.rgbm
@import clay.util.float


void main()
{
    vec2 offset = blurRadius / textureSize;

    float rnd = 6.28318 * nrand(v_Texcoord + 0.07 * percent );
    float cosa = cos(rnd);
    float sina = sin(rnd);
    vec4 basis = vec4(cosa, -sina, sina, cosa);

#if !defined(BLUR_NEARFIELD) && !defined(BLUR_COC)
    offset *= abs(decodeFloat(texture2D(coc, v_Texcoord)) * 2.0 - 1.0);
#endif

#ifdef BLUR_COC
    float cocSum = 0.0;
#else
    vec4 color = vec4(0.0);
#endif


    float weightSum = 0.0;

    for (int i = 0; i < POISSON_KERNEL_SIZE; i++) {
        vec2 ofs = poissonKernel[i];

        ofs = vec2(dot(ofs, basis.xy), dot(ofs, basis.zw));

        vec2 uv = v_Texcoord + ofs * offset;
        vec4 texel = texture2D(texture, uv);

        float w = 1.0;
#ifdef BLUR_COC
        float fCoc = decodeFloat(texel) * 2.0 - 1.0;
        // Blur coc in nearfield
        cocSum += clamp(fCoc, -1.0, 0.0) * w;
#else
        texel = texel;
    #if !defined(BLUR_NEARFIELD)
        float fCoc = decodeFloat(texture2D(coc, uv)) * 2.0 - 1.0;
        // TODO DOF premult to avoid bleeding, can be tweaked (currently x^3)
        // tradeoff between bleeding dof and out of focus object that shrinks too much
        w *= abs(fCoc);
    #endif
        texel.rgb *= texel.a;
        color += texel * w;
#endif

        weightSum += w;
    }

#ifdef BLUR_COC
    gl_FragColor = encodeFloat(clamp(cocSum / weightSum, -1.0, 0.0) * 0.5 + 0.5);
#else
    color /= weightSum;
    color.rgb /= (color.a + 0.0001);
    // TODO Windows will not be totally transparent if color.rgb is not 0 and color.a is 0.
    gl_FragColor = color;
#endif
}

@end