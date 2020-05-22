/**
 * http://en.wikipedia.org/wiki/Lambertian_reflectance
 */

@export ecgl.lambert.vertex

@import ecgl.common.transformUniforms

@import ecgl.common.uv.header


@import ecgl.common.attributes

@import ecgl.common.wireframe.vertexHeader

#ifdef VERTEX_COLOR
attribute vec4 a_Color : COLOR;
varying vec4 v_Color;
#endif


@import ecgl.common.vertexAnimation.header


varying vec3 v_Normal;
varying vec3 v_WorldPosition;

void main()
{
    @import ecgl.common.uv.main

    @import ecgl.common.vertexAnimation.main


    gl_Position = worldViewProjection * vec4(pos, 1.0);

    v_Normal = normalize((worldInverseTranspose * vec4(norm, 0.0)).xyz);
    v_WorldPosition = (world * vec4(pos, 1.0)).xyz;

#ifdef VERTEX_COLOR
    v_Color = a_Color;
#endif

    @import ecgl.common.wireframe.vertexMain
}

@end


@export ecgl.lambert.fragment

#define LAYER_DIFFUSEMAP_COUNT 0
#define LAYER_EMISSIVEMAP_COUNT 0

#define NORMAL_UP_AXIS 1
#define NORMAL_FRONT_AXIS 2

@import ecgl.common.uv.fragmentHeader

varying vec3 v_Normal;
varying vec3 v_WorldPosition;

uniform sampler2D diffuseMap;
uniform sampler2D detailMap;

@import ecgl.common.layers.header

uniform float emissionIntensity: 1.0;

uniform vec4 color : [1.0, 1.0, 1.0, 1.0];

uniform mat4 viewInverse : VIEWINVERSE;

#ifdef ATMOSPHERE_ENABLED
uniform mat4 viewTranspose: VIEWTRANSPOSE;
uniform vec3 glowColor;
uniform float glowPower;
#endif

#ifdef AMBIENT_LIGHT_COUNT
@import clay.header.ambient_light
#endif
#ifdef AMBIENT_SH_LIGHT_COUNT
@import clay.header.ambient_sh_light
#endif

#ifdef DIRECTIONAL_LIGHT_COUNT
@import clay.header.directional_light
#endif

#ifdef VERTEX_COLOR
varying vec4 v_Color;
#endif


@import ecgl.common.ssaoMap.header

@import ecgl.common.bumpMap.header

@import clay.util.srgb

@import ecgl.common.wireframe.fragmentHeader

@import clay.plugin.compute_shadow_map

void main()
{
#ifdef SRGB_DECODE
    gl_FragColor = sRGBToLinear(color);
#else
    gl_FragColor = color;
#endif

#ifdef VERTEX_COLOR
    // PENDING
    #ifdef SRGB_DECODE
    gl_FragColor *= sRGBToLinear(v_Color);
    #else
    gl_FragColor *= v_Color;
    #endif
#endif

    @import ecgl.common.albedo.main

    @import ecgl.common.diffuseLayer.main

    gl_FragColor *= albedoTexel;

    vec3 N = v_Normal;
#ifdef DOUBLE_SIDED
    vec3 eyePos = viewInverse[3].xyz;
    vec3 V = normalize(eyePos - v_WorldPosition);

    if (dot(N, V) < 0.0) {
        N = -N;
    }
#endif

    float ambientFactor = 1.0;

#ifdef BUMPMAP_ENABLED
    N = bumpNormal(v_WorldPosition, v_Normal, N);
    // PENDING
    ambientFactor = dot(v_Normal, N);
#endif

    vec3 N2 = vec3(N.x, N[NORMAL_UP_AXIS], N[NORMAL_FRONT_AXIS]);

    vec3 diffuseColor = vec3(0.0, 0.0, 0.0);

    @import ecgl.common.ssaoMap.main

#ifdef AMBIENT_LIGHT_COUNT
    for(int i = 0; i < AMBIENT_LIGHT_COUNT; i++)
    {
        // Multiply a dot factor to make sure the bump detail can be seen
        // in the dark side
        diffuseColor += ambientLightColor[i] * ambientFactor * ao;
    }
#endif
#ifdef AMBIENT_SH_LIGHT_COUNT
    for(int _idx_ = 0; _idx_ < AMBIENT_SH_LIGHT_COUNT; _idx_++)
    {{
        diffuseColor += calcAmbientSHLight(_idx_, N2) * ambientSHLightColor[_idx_] * ao;
    }}
#endif
#ifdef DIRECTIONAL_LIGHT_COUNT
#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)
    float shadowContribsDir[DIRECTIONAL_LIGHT_COUNT];
    if(shadowEnabled)
    {
        computeShadowOfDirectionalLights(v_WorldPosition, shadowContribsDir);
    }
#endif
    for(int i = 0; i < DIRECTIONAL_LIGHT_COUNT; i++)
    {
        vec3 lightDirection = -directionalLightDirection[i];
        vec3 lightColor = directionalLightColor[i];

        float shadowContrib = 1.0;
#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)
        if (shadowEnabled)
        {
            shadowContrib = shadowContribsDir[i];
        }
#endif

        float ndl = dot(N, normalize(lightDirection)) * shadowContrib;

        diffuseColor += lightColor * clamp(ndl, 0.0, 1.0);
    }
#endif

    gl_FragColor.rgb *= diffuseColor;

#ifdef ATMOSPHERE_ENABLED
    float atmoIntensity = pow(1.0 - dot(v_Normal, (viewTranspose * vec4(0.0, 0.0, 1.0, 0.0)).xyz), glowPower);
    gl_FragColor.rgb += glowColor * atmoIntensity;
#endif

    @import ecgl.common.emissiveLayer.main

    @import ecgl.common.wireframe.fragmentMain
}

@end