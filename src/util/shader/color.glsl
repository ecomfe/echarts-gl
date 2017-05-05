@export ecgl.color.vertex

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;

@import ecgl.common.uvUniforms

attribute vec2 texcoord : TEXCOORD_0;
attribute vec3 position: POSITION;

@import ecgl.common.wireframe.vertexHeader

#ifdef VERTEX_COLOR
attribute vec4 a_Color : COLOR;
varying vec4 v_Color;
#endif

#ifdef VERTEX_ANIMATION
attribute vec3 prevPosition;
uniform float percent : 1.0;
#endif

varying vec2 v_Texcoord;

void main()
{
#ifdef VERTEX_ANIMATION
    vec3 pos = mix(prevPosition, position, percent);
#else
    vec3 pos = position;
#endif

    gl_Position = worldViewProjection * vec4(pos, 1.0);
    v_Texcoord = texcoord * uvRepeat + uvOffset;

#ifdef VERTEX_COLOR
    v_Color = a_Color;
#endif

    @import ecgl.common.wireframe.vertexMain

}

@end

@export ecgl.color.fragment

#define LAYER_DIFFUSEMAP_COUNT 0
#define LAYER_EMISSIVEMAP_COUNT 0

uniform sampler2D diffuseMap;
uniform vec4 color : [1.0, 1.0, 1.0, 1.0];

#ifdef VERTEX_COLOR
varying vec4 v_Color;
#endif

@import ecgl.common.layers.header

varying vec2 v_Texcoord;

@import ecgl.common.wireframe.fragmentHeader

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

    @import ecgl.common.diffuseLayer.main

    gl_FragColor *= albedoTexel;

    @import ecgl.common.emissiveLayer.main

    @import ecgl.common.wireframe.fragmentMain

}
@end