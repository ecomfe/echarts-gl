@export ecgl.realistic.vertex

@import ecgl.common.transformUniforms

@import ecgl.common.uv.header

@import ecgl.common.attributes


@import ecgl.common.wireframe.vertexHeader

#ifdef VERTEX_COLOR
attribute vec4 a_Color : COLOR;
varying vec4 v_Color;
#endif

#ifdef NORMALMAP_ENABLED
attribute vec4 tangent : TANGENT;
varying vec3 v_Tangent;
varying vec3 v_Bitangent;
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

#ifdef NORMALMAP_ENABLED
    v_Tangent = normalize((worldInverseTranspose * vec4(tangent.xyz, 0.0)).xyz);
    v_Bitangent = normalize(cross(v_Normal, v_Tangent) * tangent.w);
#endif

    @import ecgl.common.wireframe.vertexMain

}

@end



@export ecgl.realistic.fragment

#define LAYER_DIFFUSEMAP_COUNT 0
#define LAYER_EMISSIVEMAP_COUNT 0
#define PI 3.14159265358979
#define ROUGHNESS_CHANEL 0
#define METALNESS_CHANEL 1

#define NORMAL_UP_AXIS 1
#define NORMAL_FRONT_AXIS 2

#ifdef VERTEX_COLOR
varying vec4 v_Color;
#endif

@import ecgl.common.uv.fragmentHeader

varying vec3 v_Normal;
varying vec3 v_WorldPosition;

// diffuseMap, bumpMap use v_Texcoord
uniform sampler2D diffuseMap;

// detailMap, metalnessMap, roughnessMap, normalMap use v_DetailTexcoord.
uniform sampler2D detailMap;
uniform sampler2D metalnessMap;
uniform sampler2D roughnessMap;

@import ecgl.common.layers.header

uniform float emissionIntensity: 1.0;

uniform vec4 color : [1.0, 1.0, 1.0, 1.0];

uniform float metalness : 0.0;
uniform float roughness : 0.5;

uniform mat4 viewInverse : VIEWINVERSE;

#ifdef AMBIENT_LIGHT_COUNT
@import clay.header.ambient_light
#endif

#ifdef AMBIENT_SH_LIGHT_COUNT
@import clay.header.ambient_sh_light
#endif

#ifdef AMBIENT_CUBEMAP_LIGHT_COUNT
@import clay.header.ambient_cubemap_light
#endif

#ifdef DIRECTIONAL_LIGHT_COUNT
@import clay.header.directional_light
#endif

@import ecgl.common.normalMap.fragmentHeader

@import ecgl.common.ssaoMap.header

@import ecgl.common.bumpMap.header

@import clay.util.srgb

@import clay.util.rgbm

@import ecgl.common.wireframe.fragmentHeader

@import clay.plugin.compute_shadow_map

// Fresnel
vec3 F_Schlick(float ndv, vec3 spec) {
    return spec + (1.0 - spec) * pow(1.0 - ndv, 5.0);
}

float D_Phong(float g, float ndh) {
    // from black ops 2
    float a = pow(8192.0, g);
    return (a + 2.0) / 8.0 * pow(ndh, a);
}

void main()
{
    vec4 albedoColor = color;

    vec3 eyePos = viewInverse[3].xyz;
    vec3 V = normalize(eyePos - v_WorldPosition);
#ifdef VERTEX_COLOR
    // PENDING
    #ifdef SRGB_DECODE
    albedoColor *= sRGBToLinear(v_Color);
    #else
    albedoColor *= v_Color;
    #endif
#endif

    @import ecgl.common.albedo.main

    @import ecgl.common.diffuseLayer.main

    albedoColor *= albedoTexel;

    float m = metalness;

#ifdef METALNESSMAP_ENABLED
    float m2 = texture2D(metalnessMap, v_DetailTexcoord)[METALNESS_CHANEL];
    // Adjust the brightness
    m = clamp(m2 + (m - 0.5) * 2.0, 0.0, 1.0);
#endif

    vec3 baseColor = albedoColor.rgb;
    albedoColor.rgb = baseColor * (1.0 - m);
    vec3 specFactor = mix(vec3(0.04), baseColor, m);

    float g = 1.0 - roughness;

#ifdef ROUGHNESSMAP_ENABLED
    float g2 = 1.0 - texture2D(roughnessMap, v_DetailTexcoord)[ROUGHNESS_CHANEL];
    // Adjust the brightness
    g = clamp(g2 + (g - 0.5) * 2.0, 0.0, 1.0);
#endif

    vec3 N = v_Normal;

#ifdef DOUBLE_SIDED
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

@import ecgl.common.normalMap.fragmentMain

    vec3 N2 = vec3(N.x, N[NORMAL_UP_AXIS], N[NORMAL_FRONT_AXIS]);

    vec3 diffuseTerm = vec3(0.0);
    vec3 specularTerm = vec3(0.0);

    float ndv = clamp(dot(N, V), 0.0, 1.0);
    vec3 fresnelTerm = F_Schlick(ndv, specFactor);

    @import ecgl.common.ssaoMap.main

#ifdef AMBIENT_LIGHT_COUNT
    for(int _idx_ = 0; _idx_ < AMBIENT_LIGHT_COUNT; _idx_++)
    {{
        // Multiply a dot factor to make sure the bump detail can be seen
        // in the dark side
        diffuseTerm += ambientLightColor[_idx_] * ambientFactor * ao;
    }}
#endif

#ifdef AMBIENT_SH_LIGHT_COUNT
    for(int _idx_ = 0; _idx_ < AMBIENT_SH_LIGHT_COUNT; _idx_++)
    {{
        diffuseTerm += calcAmbientSHLight(_idx_, N2) * ambientSHLightColor[_idx_] * ao;
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
    for(int _idx_ = 0; _idx_ < DIRECTIONAL_LIGHT_COUNT; _idx_++)
    {{
        vec3 L = -directionalLightDirection[_idx_];
        vec3 lc = directionalLightColor[_idx_];

        vec3 H = normalize(L + V);
        float ndl = clamp(dot(N, normalize(L)), 0.0, 1.0);
        float ndh = clamp(dot(N, H), 0.0, 1.0);

        float shadowContrib = 1.0;
#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)
        if (shadowEnabled)
        {
            shadowContrib = shadowContribsDir[_idx_];
        }
#endif

        vec3 li = lc * ndl * shadowContrib;

        diffuseTerm += li;
        specularTerm += li * fresnelTerm * D_Phong(g, ndh);
    }}
#endif


#ifdef AMBIENT_CUBEMAP_LIGHT_COUNT
    vec3 L = reflect(-V, N);
    L = vec3(L.x, L[NORMAL_UP_AXIS], L[NORMAL_FRONT_AXIS]);
    float rough2 = clamp(1.0 - g, 0.0, 1.0);
    // FIXME fixed maxMipmapLevel ?
    float bias2 = rough2 * 5.0;
    // One brdf lookup is enough
    vec2 brdfParam2 = texture2D(ambientCubemapLightBRDFLookup[0], vec2(rough2, ndv)).xy;
    vec3 envWeight2 = specFactor * brdfParam2.x + brdfParam2.y;
    vec3 envTexel2;
    for(int _idx_ = 0; _idx_ < AMBIENT_CUBEMAP_LIGHT_COUNT; _idx_++)
    {{
        envTexel2 = RGBMDecode(textureCubeLodEXT(ambientCubemapLightCubemap[_idx_], L, bias2), 8.12);
        // TODO mix ?
        specularTerm += ambientCubemapLightColor[_idx_] * envTexel2 * envWeight2 * ao;
    }}
#endif

    gl_FragColor.rgb = albedoColor.rgb * diffuseTerm + specularTerm;
    gl_FragColor.a = albedoColor.a;

#ifdef SRGB_ENCODE
    gl_FragColor = linearTosRGB(gl_FragColor);
#endif

    @import ecgl.common.emissiveLayer.main

    @import ecgl.common.wireframe.fragmentMain
}

@end