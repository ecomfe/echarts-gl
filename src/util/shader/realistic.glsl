@export ecgl.realistic.vertex

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;
uniform mat4 worldInverseTranspose : WORLDINVERSETRANSPOSE;
uniform mat4 world : WORLD;

uniform vec2 uvRepeat : [1.0, 1.0];
uniform vec2 uvOffset : [0.0, 0.0];

attribute vec3 position : POSITION;
attribute vec2 texcoord : TEXCOORD_0;
attribute vec3 normal : NORMAL;

@import ecgl.wireframe.common.vertexHeader

#ifdef VERTEX_COLOR
attribute vec4 a_Color : COLOR;
varying vec4 v_Color;
#endif

varying vec2 v_Texcoord;

varying vec3 v_Normal;
varying vec3 v_WorldPosition;

void main()
{
    v_Texcoord = texcoord * uvRepeat + uvOffset;

    gl_Position = worldViewProjection * vec4(position, 1.0);

    v_Normal = normalize((worldInverseTranspose * vec4(normal, 0.0)).xyz);
    v_WorldPosition = (world * vec4(position, 1.0)).xyz;

#ifdef VERTEX_COLOR
    v_Color = a_Color;
#endif

    @import ecgl.wireframe.common.vertexMain

}

@end


@export ecgl.realistic.fragment

#define LAYER_DIFFUSEMAP_COUNT 0
#define LAYER_EMISSIVEMAP_COUNT 0
#define PI 3.14159265358979

#ifdef VERTEX_COLOR
varying vec4 v_Color;
#endif

varying vec2 v_Texcoord;
varying vec3 v_Normal;
varying vec3 v_WorldPosition;

#ifdef DIFFUSEMAP_ENABLED
uniform sampler2D diffuseMap;
#endif

#if (LAYER_DIFFUSEMAP_COUNT > 0)
uniform sampler2D layerDiffuseMap[LAYER_DIFFUSEMAP_COUNT];
#endif

#if (LAYER_EMISSIVEMAP_COUNT > 0)
uniform float layerEmissionIntensity[LAYER_EMISSIVEMAP_COUNT];
uniform sampler2D layerEmissiveMap[LAYER_EMISSIVEMAP_COUNT];
#endif

uniform float emissionIntensity: 1.0;

#ifdef BUMPMAP_ENABLED
uniform sampler2D bumpMap;
uniform float bumpScale : 1.0;
// Derivative maps - bump mapping unparametrized surfaces by Morten Mikkelsen
//  http://mmikkelsen3d.blogspot.sk/2011/07/derivative-maps.html

// Evaluate the derivative of the height w.r.t. screen-space using forward differencing (listing 2)

vec3 perturbNormalArb(vec3 surfPos, vec3 surfNormal, vec3 baseNormal)
{
    vec2 dSTdx = dFdx(v_Texcoord);
    vec2 dSTdy = dFdy(v_Texcoord);

    float Hll = bumpScale * texture2D(bumpMap, v_Texcoord).x;
    float dHx = bumpScale * texture2D(bumpMap, v_Texcoord + dSTdx).x - Hll;
    float dHy = bumpScale * texture2D(bumpMap, v_Texcoord + dSTdy).x - Hll;

    vec3 vSigmaX = dFdx(surfPos);
    vec3 vSigmaY = dFdy(surfPos);
    vec3 vN = surfNormal;

    vec3 R1 = cross(vSigmaY, vN);
    vec3 R2 = cross(vN, vSigmaX);

    float fDet = dot(vSigmaX, R1);

    vec3 vGrad = sign(fDet) * (dHx * R1 + dHy * R2);
    return normalize(abs(fDet) * baseNormal - vGrad);

}
#endif

uniform vec4 color : [1.0, 1.0, 1.0, 1.0];

uniform float metalness : 0.0;
uniform float roughness : 0.5;

uniform mat4 viewInverse : VIEWINVERSE;

#ifdef AMBIENT_LIGHT_COUNT
@import qtek.header.ambient_light
#endif

#ifdef AMBIENT_SH_LIGHT_COUNT
@import qtek.header.ambient_sh_light
#endif

#ifdef AMBIENT_CUBEMAP_LIGHT_COUNT
@import qtek.header.ambient_cubemap_light
#endif

#ifdef DIRECTIONAL_LIGHT_COUNT
@import qtek.header.directional_light
#endif

@import qtek.util.srgb

@import qtek.util.rgbm

@import ecgl.wireframe.common.fragmentHeader

@import qtek.plugin.compute_shadow_map

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
    albedoColor *= albedoTexel;

    vec3 baseColor = albedoColor.rgb;
    albedoColor.rgb = baseColor * (1.0 - metalness);
    vec3 specFactor = mix(vec3(0.04), baseColor, metalness);

    float g = 1.0 - roughness;

    vec3 N = v_Normal;

#ifdef DOUBLE_SIDE
    if (dot(N, V) < 0.0) {
        N = -N;
    }
#endif

    float ambientFactor = 1.0;

#ifdef BUMPMAP_ENABLED
    N = perturbNormalArb(v_WorldPosition, v_Normal, N);
    // PENDING
    ambientFactor = dot(v_Normal, N);
#endif

    vec3 diffuseTerm = vec3(0.0);
    vec3 specularTerm = vec3(0.0);

    float ndv = clamp(dot(N, V), 0.0, 1.0);
    vec3 fresnelTerm = F_Schlick(ndv, specFactor);

#ifdef AMBIENT_LIGHT_COUNT
    for(int _idx_ = 0; _idx_ < AMBIENT_LIGHT_COUNT; _idx_++)
    {{
        // Multiply a dot factor to make sure the bump detail can be seen
        // in the dark side
        diffuseTerm += ambientLightColor[_idx_] * ambientFactor;
    }}
#endif

#ifdef AMBIENT_SH_LIGHT_COUNT
    for(int _idx_ = 0; _idx_ < AMBIENT_SH_LIGHT_COUNT; _idx_++)
    {{
        diffuseTerm += calcAmbientSHLight(_idx_, N) * ambientSHLightColor[_idx_];
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
    float rough2 = clamp(1.0 - g, 0.0, 1.0);
    // FIXME fixed maxMipmapLevel ?
    float bias2 = rough2 * 5.0;
    // One brdf lookup is enough
    vec2 brdfParam2 = texture2D(ambientCubemapLightBRDFLookup[0], vec2(rough2, ndv)).xy;
    vec3 envWeight2 = specFactor * brdfParam2.x + brdfParam2.y;
    vec3 envTexel2;
    for(int _idx_ = 0; _idx_ < AMBIENT_CUBEMAP_LIGHT_COUNT; _idx_++)
    {{
        envTexel2 = RGBMDecode(textureCubeLodEXT(ambientCubemapLightCubemap[_idx_], L, bias2), 51.5);
        // TODO mix ?
        specularTerm += ambientCubemapLightColor[_idx_] * envTexel2 * envWeight2;
    }}
#endif

    gl_FragColor.rgb = albedoColor.rgb * diffuseTerm + specularTerm;
    gl_FragColor.a = albedoColor.a;

    #ifdef SRGB_ENCODE
    gl_FragColor = linearTosRGB(gl_FragColor);
    #endif

#if (LAYER_EMISSIVEMAP_COUNT > 0)
    for (int _idx_ = 0; _idx_ < LAYER_EMISSIVEMAP_COUNT; _idx_++)
    {{
        // PENDING sRGB ?
        vec4 texel2 = texture2D(layerEmissiveMap[_idx_], v_Texcoord) * layerEmissionIntensity[_idx_];
        float intensity = layerEmissionIntensity[_idx_];
        gl_FragColor.rgb = mix(gl_FragColor.rgb, texel2.rgb * intensity, texel2.a);
    }}
#endif

    @import ecgl.wireframe.common.fragmentMain
}

@end