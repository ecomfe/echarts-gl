// Only display shadow

@export ecgl.displayShadow.vertex

@import ecgl.common.transformUniforms

@import ecgl.common.uv.header

@import ecgl.common.attributes

varying vec3 v_WorldPosition;

varying vec3 v_Normal;

void main()
{
    @import ecgl.common.uv.main
    v_Normal = normalize((worldInverseTranspose * vec4(normal, 0.0)).xyz);

    v_WorldPosition = (world * vec4(position, 1.0)).xyz;
    gl_Position = worldViewProjection * vec4(position, 1.0);
}

@end


@export ecgl.displayShadow.fragment

@import ecgl.common.uv.fragmentHeader

varying vec3 v_Normal;
varying vec3 v_WorldPosition;

// For reflection.
uniform float roughness: 0.2;

#ifdef DIRECTIONAL_LIGHT_COUNT
@import clay.header.directional_light
#endif

@import ecgl.common.ssaoMap.header

@import clay.plugin.compute_shadow_map

void main()
{
    float shadow = 1.0;

    @import ecgl.common.ssaoMap.main

#if defined(DIRECTIONAL_LIGHT_COUNT) && defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)
    float shadowContribsDir[DIRECTIONAL_LIGHT_COUNT];
    if(shadowEnabled)
    {
        computeShadowOfDirectionalLights(v_WorldPosition, shadowContribsDir);
    }
    for (int i = 0; i < DIRECTIONAL_LIGHT_COUNT; i++) {
        shadow = min(shadow, shadowContribsDir[i] * 0.5 + 0.5);
    }
#endif

    shadow *= 0.5 + ao * 0.5;
    shadow = clamp(shadow, 0.0, 1.0);

    gl_FragColor = vec4(vec3(0.0), 1.0 - shadow);
}

@end