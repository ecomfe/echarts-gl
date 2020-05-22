@export ecgl.color.vertex

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;

@import ecgl.common.uv.header

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

#ifdef ATMOSPHERE_ENABLED
attribute vec3 normal: NORMAL;
uniform mat4 worldInverseTranspose : WORLDINVERSETRANSPOSE;
varying vec3 v_Normal;
#endif

void main()
{
#ifdef VERTEX_ANIMATION
    vec3 pos = mix(prevPosition, position, percent);
#else
    vec3 pos = position;
#endif

    gl_Position = worldViewProjection * vec4(pos, 1.0);

    @import ecgl.common.uv.main

#ifdef VERTEX_COLOR
    v_Color = a_Color;
#endif

#ifdef ATMOSPHERE_ENABLED
    v_Normal = normalize((worldInverseTranspose * vec4(normal, 0.0)).xyz);
#endif

    @import ecgl.common.wireframe.vertexMain

}

@end

@export ecgl.color.fragment

#define LAYER_DIFFUSEMAP_COUNT 0
#define LAYER_EMISSIVEMAP_COUNT 0

uniform sampler2D diffuseMap;
uniform sampler2D detailMap;

uniform vec4 color : [1.0, 1.0, 1.0, 1.0];

#ifdef ATMOSPHERE_ENABLED
uniform mat4 viewTranspose: VIEWTRANSPOSE;
uniform vec3 glowColor;
uniform float glowPower;
varying vec3 v_Normal;
#endif

#ifdef VERTEX_COLOR
varying vec4 v_Color;
#endif

@import ecgl.common.layers.header

@import ecgl.common.uv.fragmentHeader

@import ecgl.common.wireframe.fragmentHeader

@import clay.util.srgb

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

    @import ecgl.common.albedo.main

    @import ecgl.common.diffuseLayer.main

    gl_FragColor *= albedoTexel;

#ifdef ATMOSPHERE_ENABLED
    float atmoIntensity = pow(1.0 - dot(v_Normal, (viewTranspose * vec4(0.0, 0.0, 1.0, 0.0)).xyz), glowPower);
    gl_FragColor.rgb += glowColor * atmoIntensity;
#endif

    @import ecgl.common.emissiveLayer.main

    @import ecgl.common.wireframe.fragmentMain

}
@end