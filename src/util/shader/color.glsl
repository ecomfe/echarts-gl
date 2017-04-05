@export ecgl.color.vertex

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;
uniform vec2 uvRepeat: [1, 1];

attribute vec2 texcoord : TEXCOORD_0;
attribute vec3 position: POSITION;

@import ecgl.wireframe.common.vertexHeader

#ifdef VERTEX_COLOR
attribute vec4 a_Color : COLOR;
varying vec4 v_Color;
#endif

varying vec2 v_Texcoord;

void main()
{
    gl_Position = worldViewProjection * vec4(position, 1.0);
    v_Texcoord = texcoord * uvRepeat;

#ifdef VERTEX_COLOR
    v_Color = a_Color;
#endif

    @import ecgl.wireframe.common.vertexMain

}

@end

@export ecgl.color.fragment

#define LAYER_DIFFUSEMAP_COUNT 0
#define LAYER_EMISSIVEMAP_COUNT 0

uniform sampler2D diffuseMap;
uniform vec4 color : [1.0, 1.0, 1.0, 1.0];

uniform float emissionIntensity: 1.0;

#ifdef VERTEX_COLOR
varying vec4 v_Color;
#endif

#if (LAYER_DIFFUSEMAP_COUNT > 0)
uniform sampler2D layerDiffuseMap[LAYER_DIFFUSEMAP_COUNT];
#endif

#if (LAYER_EMISSIVEMAP_COUNT > 0)
uniform sampler2D layerEmissiveMap[LAYER_EMISSIVEMAP_COUNT];
#endif

varying vec2 v_Texcoord;

@import ecgl.wireframe.common.fragmentHeader

@import qtek.util.srgb

void main()
{
#ifdef SRGB_DECODE
    gl_FragColor = sRGBToLinear(color);
#else
    gl_FragColor = color;
#endif

#ifdef VERTEX_COLOR
    gl_FragColor *= v_Color;
#endif

    vec4 albedoTexel = vec4(1.0);
#ifdef DIFFUSEMAP_ENABLED
    albedoTexel = texture2D(diffuseMap, v_Texcoord);
    #ifdef SRGB_DECODE
    albedoTexel = sRGBToLinear(albedoTexel);
    #endif
#endif

#if (LAYER_DIFFUSEMAP_COUNT > 0)
    for (int _idx_ = 0; _idx_ < LAYER_DIFFUSEMAP_COUNT; _idx_++) {{
        vec4 texel2 = texture2D(layerDiffuseMap[_idx_], v_Texcoord);
        #ifdef SRGB_DECODE
        texel2 = sRGBToLinear(texel2);
        #endif
        // source-over blend
        albedoTexel.rgb = mix(albedoTexel.rgb, texel2.rgb, texel2.a);
        albedoTexel.a = texel2.a + (1.0 - texel2.a) * albedoTexel.a;
    }}
#endif
    gl_FragColor *= albedoTexel;

#if (LAYER_EMISSIVEMAP_COUNT > 0)
    for (int _idx_ = 0; _idx_ < LAYER_EMISSIVEMAP_COUNT; _idx_++) {{
        // PENDING BLEND?
        vec4 texel2 = texture2D(layerEmissiveMap[_idx_], v_Texcoord);
        gl_FragColor.rgb += texel2.rgb * texel2.a * emissionIntensity;
    }}
#endif


    @import ecgl.wireframe.common.fragmentMain

}
@end