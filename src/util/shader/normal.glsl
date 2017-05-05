@export ecgl.normal.vertex

@import ecgl.common.transformUniforms

@import ecgl.common.uvUniforms

@import ecgl.common.attributes

varying vec2 v_Texcoord;
varying vec3 v_Normal;

@import ecgl.common.normalMap.vertexHeader

void main()
{
    gl_Position = worldViewProjection * vec4(position, 1.0);

    v_Texcoord = texcoord * uvRepeat + uvOffset;

    v_Normal = normalize((worldInverseTranspose * vec4(normal, 0.0)).xyz);

@import ecgl.common.normalMap.vertexMain
}


@end


@export ecgl.normal.fragment

varying vec2 v_Texcoord;
varying vec3 v_Normal;

@import ecgl.common.normalMap.fragmentHeader

void main()
{
    vec3 N = v_Normal;

    @import ecgl.common.normalMap.fragmentMain

    gl_FragColor.rgb = (N.xyz + 1.0) * 0.5;
    gl_FragColor.a = 1.0;
}
@end