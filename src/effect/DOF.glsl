@export ecgl.dof.diskBlur

#define POISSON_KERNEL_SIZE 16;

uniform sampler2D texture;
uniform sampler2D coc;
varying vec2 v_Texcoord;

uniform float blurSize : 10.0;
uniform vec2 textureSize : [512.0, 512.0];

uniform float percent;

float nrand(const in vec2 n) {
    return fract(sin(dot(n.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

@import qtek.util.rgbm
@import qtek.util.float


void main()
{
    vec2 fTaps_Poisson[POISSON_KERNEL_SIZE];
    // https://github.com/bartwronski/PoissonSamplingGenerator
    fTaps_Poisson[0] = vec2(-0.399691779231, 0.728591545584);
    fTaps_Poisson[1] = vec2(-0.48622557676, -0.84016533712);
    fTaps_Poisson[2] = vec2(0.770309468987, -0.24906070432);
    fTaps_Poisson[3] = vec2(0.556596796154, 0.820359876432);
    fTaps_Poisson[4] = vec2(-0.933902004071, 0.0600539051593);
    fTaps_Poisson[5] = vec2(0.330144964342, 0.207477293384);
    fTaps_Poisson[6] = vec2(0.289013230975, -0.686749271417);
    fTaps_Poisson[7] = vec2(-0.0832470893559, -0.187351643125);
    fTaps_Poisson[8] = vec2(-0.296314525615, 0.254474834305);
    fTaps_Poisson[9] = vec2(-0.850977666059, 0.484642744689);
    fTaps_Poisson[10] = vec2(0.829287915319, 0.2345063545);
    fTaps_Poisson[11] = vec2(-0.773042143899, -0.543741521254);
    fTaps_Poisson[12] = vec2(0.0561133030864, 0.928419742597);
    fTaps_Poisson[13] = vec2(-0.205799249508, -0.562072714492);
    fTaps_Poisson[14] = vec2(-0.526991665882, -0.193690188118);
    fTaps_Poisson[15] = vec2(-0.051789270667, -0.935374050821);

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
        vec2 ofs = fTaps_Poisson[i];

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
        w *= fCoc * fCoc;
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