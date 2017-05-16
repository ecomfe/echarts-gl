@export ecgl.normal.vertex

@import ecgl.common.transformUniforms

@import ecgl.common.uvUniforms

@import ecgl.common.attributes

varying vec2 v_Texcoord;
varying vec3 v_Normal;
varying vec3 v_WorldPosition;

@import ecgl.common.normalMap.vertexHeader

@import ecgl.common.vertexAnimation.header

void main()
{

    // TODO Animation
    @import ecgl.common.vertexAnimation.main

    v_Texcoord = texcoord * uvRepeat + uvOffset;

    v_Normal = normalize((worldInverseTranspose * vec4(normal, 0.0)).xyz);
    v_WorldPosition = (world * vec4(pos, 1.0)).xyz;

    @import ecgl.common.normalMap.vertexMain

    gl_Position = worldViewProjection * vec4(pos, 1.0);

}


@end


@export ecgl.normal.fragment

uniform bool useBumpMap;
uniform bool doubleSide;

varying vec2 v_Texcoord;
varying vec3 v_Normal;
varying vec3 v_WorldPosition;

uniform mat4 viewInverse : VIEWINVERSE;

@import ecgl.common.normalMap.fragmentHeader
@import ecgl.common.bumpMap.header

void main()
{
    vec3 N = v_Normal;

    @import ecgl.common.normalMap.fragmentMain

    if (useBumpMap) {
        N = bumpNormal(v_WorldPosition, v_Normal, N);
    }

    if (doubleSide) {
        vec3 eyePos = viewInverse[3].xyz;
        vec3 V = normalize(eyePos - v_WorldPosition);

        if (dot(N, V) < 0.0) {
            N = -N;
        }
    }

    gl_FragColor.rgb = (N.xyz + 1.0) * 0.5;
    gl_FragColor.a = 1.0;
}
@end