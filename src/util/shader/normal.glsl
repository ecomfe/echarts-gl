@export ecgl.normal.vertex

@import ecgl.common.transformUniforms

@import ecgl.common.uv.header

@import ecgl.common.attributes

varying vec3 v_Normal;
varying vec3 v_WorldPosition;

@import ecgl.common.normalMap.vertexHeader

@import ecgl.common.vertexAnimation.header

void main()
{

    // TODO Animation
    @import ecgl.common.vertexAnimation.main

    @import ecgl.common.uv.main

    v_Normal = normalize((worldInverseTranspose * vec4(normal, 0.0)).xyz);
    v_WorldPosition = (world * vec4(pos, 1.0)).xyz;

    @import ecgl.common.normalMap.vertexMain

    gl_Position = worldViewProjection * vec4(pos, 1.0);

}


@end


@export ecgl.normal.fragment

#define ROUGHNESS_CHANEL 0

uniform bool useBumpMap;
uniform bool useRoughnessMap;
uniform bool doubleSide;
uniform float roughness;

@import ecgl.common.uv.fragmentHeader

varying vec3 v_Normal;
varying vec3 v_WorldPosition;

uniform mat4 viewInverse : VIEWINVERSE;

@import ecgl.common.normalMap.fragmentHeader
@import ecgl.common.bumpMap.header

uniform sampler2D roughnessMap;

void main()
{
    vec3 N = v_Normal;
    
    bool flipNormal = false;
    if (doubleSide) {
        vec3 eyePos = viewInverse[3].xyz;
        vec3 V = normalize(eyePos - v_WorldPosition);

        if (dot(N, V) < 0.0) {
            flipNormal = true;
        }
    }

    @import ecgl.common.normalMap.fragmentMain

    if (useBumpMap) {
        N = bumpNormal(v_WorldPosition, v_Normal, N);
    }

    float g = 1.0 - roughness;

    if (useRoughnessMap) {
        float g2 = 1.0 - texture2D(roughnessMap, v_DetailTexcoord)[ROUGHNESS_CHANEL];
        // Adjust the brightness
        g = clamp(g2 + (g - 0.5) * 2.0, 0.0, 1.0);
    }

    if (flipNormal) {
        N = -N;
    }

    gl_FragColor.rgb = (N.xyz + 1.0) * 0.5;
    gl_FragColor.a = g;
}
@end