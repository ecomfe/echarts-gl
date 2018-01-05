@export ecgl.hatching.vertex

@import ecgl.realistic.vertex

@end


@export ecgl.hatching.fragment

#define NORMAL_UP_AXIS 1
#define NORMAL_FRONT_AXIS 2

@import ecgl.common.uv.fragmentHeader

varying vec3 v_Normal;
varying vec3 v_WorldPosition;

uniform vec4 color : [0.0, 0.0, 0.0, 1.0];
uniform vec4 paperColor : [1.0, 1.0, 1.0, 1.0];

uniform mat4 viewInverse : VIEWINVERSE;

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

uniform sampler2D hatch1;
uniform sampler2D hatch2;
uniform sampler2D hatch3;
uniform sampler2D hatch4;
uniform sampler2D hatch5;
uniform sampler2D hatch6;

// https://github.com/spite/cross-hatching
// http://gfx.cs.princeton.edu/proj/hatching/hatching.pdf
float shade(in float tone) {
    vec4 c = vec4(1. ,1., 1., 1.);
    float step = 1. / 6.;
    vec2 uv = v_DetailTexcoord;
    if (tone <= step / 2.0) {
        c = mix(vec4(0.), texture2D(hatch6, uv), 12. * tone);
    }
    else if (tone <= step) {
        c = mix(texture2D(hatch6, uv), texture2D(hatch5, uv), 6. * tone);
    }
    if(tone > step && tone <= 2. * step){
        c = mix(texture2D(hatch5, uv), texture2D(hatch4, uv) , 6. * (tone - step));
    }
    if(tone > 2. * step && tone <= 3. * step){
        c = mix(texture2D(hatch4, uv), texture2D(hatch3, uv), 6. * (tone - 2. * step));
    }
    if(tone > 3. * step && tone <= 4. * step){
        c = mix(texture2D(hatch3, uv), texture2D(hatch2, uv), 6. * (tone - 3. * step));
    }
    if(tone > 4. * step && tone <= 5. * step){
        c = mix(texture2D(hatch2, uv), texture2D(hatch1, uv), 6. * (tone - 4. * step));
    }
    if(tone > 5. * step){
        c = mix(texture2D(hatch1, uv), vec4(1.), 6. * (tone - 5. * step));
    }

    return c.r;
}

const vec3 w = vec3(0.2125, 0.7154, 0.0721);

void main()
{
#ifdef SRGB_DECODE
    vec4 inkColor = sRGBToLinear(color);
#else
    vec4 inkColor = color;
#endif

#ifdef VERTEX_COLOR
    // PENDING
    #ifdef SRGB_DECODE
    inkColor *= sRGBToLinear(v_Color);
    #else
    inkColor *= v_Color;
    #endif
#endif

    vec3 N = v_Normal;
#ifdef DOUBLE_SIDED
    vec3 eyePos = viewInverse[3].xyz;
    vec3 V = normalize(eyePos - v_WorldPosition);

    if (dot(N, V) < 0.0) {
        N = -N;
    }
#endif

    float tone = 0.0;

    float ambientFactor = 1.0;

#ifdef BUMPMAP_ENABLED
    N = bumpNormal(v_WorldPosition, v_Normal, N);
    // PENDING
    ambientFactor = dot(v_Normal, N);
#endif

    vec3 N2 = vec3(N.x, N[NORMAL_UP_AXIS], N[NORMAL_FRONT_AXIS]);

    @import ecgl.common.ssaoMap.main

#ifdef AMBIENT_LIGHT_COUNT
    for(int i = 0; i < AMBIENT_LIGHT_COUNT; i++)
    {
        // Multiply a dot factor to make sure the bump detail can be seen
        // in the dark side
        tone += dot(ambientLightColor[i], w) * ambientFactor * ao;
    }
#endif
#ifdef AMBIENT_SH_LIGHT_COUNT
    for(int _idx_ = 0; _idx_ < AMBIENT_SH_LIGHT_COUNT; _idx_++)
    {{
        tone += dot(calcAmbientSHLight(_idx_, N2) * ambientSHLightColor[_idx_], w) * ao;
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
        float lightTone = dot(directionalLightColor[i], w);

        float shadowContrib = 1.0;
#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)
        if (shadowEnabled)
        {
            shadowContrib = shadowContribsDir[i];
        }
#endif

        float ndl = dot(N, normalize(lightDirection)) * shadowContrib;

        tone += lightTone * clamp(ndl, 0.0, 1.0);
    }
#endif

    gl_FragColor = mix(inkColor, paperColor, shade(clamp(tone, 0.0, 1.0)));
    // gl_FragColor = vec4(vec3(clamp(tone, 0.0, 1.0)), 1.0);
}
@end
