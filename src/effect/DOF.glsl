@export ecgl.dof.diskBlur

#define POISSON_KERNEL_SIZE 16;

uniform sampler2D texture;
uniform sampler2D coc;
varying vec2 v_Texcoord;

uniform float blurSize : 10.0;
uniform vec2 textureSize : [512.0, 512.0];

uniform vec2 poissonKernel[POISSON_KERNEL_SIZE];

uniform float percent;

float nrand(const in vec2 n) {
    return fract(sin(dot(n.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

@import qtek.util.rgbm
@import qtek.util.float


void main()
{
    vec2 offset = blurSize / textureSize;

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
        texel = decodeHDR(texel);
    #if !defined(BLUR_NEARFIELD)
        float fCoc = decodeFloat(texture2D(coc, uv)) * 2.0 - 1.0;
        // TODO DOF premult to avoid bleeding, can be tweaked (currently x^3)
        // tradeoff between bleeding dof and out of focus object that shrinks too much
        w *= abs(fCoc);
    #endif
        color += texel * w;
#endif

        weightSum += w;
    }

#ifdef BLUR_COC
    gl_FragColor = encodeFloat(clamp(cocSum / weightSum, -1.0, 0.0) * 0.5 + 0.5);
#else
    color /= weightSum;
    // TODO Windows will not be totally transparent if color.rgb is not 0 and color.a is 0.
    gl_FragColor = encodeHDR(color);
#endif
}

@end