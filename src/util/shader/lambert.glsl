/**
 * http://en.wikipedia.org/wiki/Lambertian_reflectance
 */

@export ecgl.lambert.vertex

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;
uniform mat4 worldInverseTranspose : WORLDINVERSETRANSPOSE;
uniform mat4 world : WORLD;

uniform vec2 uvRepeat : [1.0, 1.0];
uniform vec2 uvOffset : [0.0, 0.0];

attribute vec3 position : POSITION;
attribute vec2 texcoord : TEXCOORD_0;
attribute vec3 normal : NORMAL;

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
}

@end


@export ecgl.lambert.fragment

#define LAYER_DIFFUSEMAP_COUNT 0
#define LAYER_EMISSIVEMAP_COUNT 0
#define PI 3.14159265358979

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

uniform vec3 color : [1.0, 1.0, 1.0];
uniform float alpha : 1.0;

#ifdef AMBIENT_LIGHT_COUNT
@import qtek.header.ambient_light
#endif
#ifdef DIRECTIONAL_LIGHT_COUNT
@import qtek.header.directional_light
#endif

#ifdef VERTEX_COLOR
varying vec4 v_Color;
#endif

@import qtek.util.srgb

void main()
{
    gl_FragColor = vec4(color, alpha);

#ifdef VERTEX_COLOR
    // PENDING
    #ifdef SRGB_DECODE
    gl_FragColor *= sRGBToLinear(v_Color);
    #else
    gl_FragColor *= v_Color;
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
        albedoTexel.rgb = texel2.rgb * texel2.a + albedoTexel.rgb * (1.0 - texel2.a);
        albedoTexel.a = texel2.a + (1.0 - texel2.a) * albedoTexel.a;
    }}
#endif
    gl_FragColor *= albedoTexel;

    vec3 N = v_Normal;
    vec3 P = v_WorldPosition;
    float ambientFactor = 1.0;

#ifdef BUMPMAP_ENABLED
    N = perturbNormalArb(v_WorldPosition, v_Normal, N);
    #ifdef FLAT
        ambientFactor = dot(P, N);
    #else
        ambientFactor = dot(v_Normal, N);
    #endif
#endif

vec3 diffuseColor = vec3(0.0, 0.0, 0.0);

#ifdef AMBIENT_LIGHT_COUNT
    for(int i = 0; i < AMBIENT_LIGHT_COUNT; i++)
    {
        // Multiply a dot factor to make sure the bump detail can be seen
        // in the dark side
        diffuseColor += ambientLightColor[i] * ambientFactor;
    }
#endif
#ifdef DIRECTIONAL_LIGHT_COUNT
    for(int i = 0; i < DIRECTIONAL_LIGHT_COUNT; i++)
    {
        vec3 lightDirection = -directionalLightDirection[i];
        vec3 lightColor = directionalLightColor[i];

        float ndl = dot(N, normalize(lightDirection));

        float shadowContrib = 1.0;
        #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)
            if(shadowEnabled)
            {
                shadowContrib = shadowContribs[i];
            }
        #endif

        diffuseColor += lightColor * clamp(ndl, 0.0, 1.0) * shadowContrib;
    }
#endif

    gl_FragColor.rgb *= diffuseColor;

#if (LAYER_EMISSIVEMAP_COUNT > 0)
    for (int _idx_ = 0; _idx_ < LAYER_EMISSIVEMAP_COUNT; _idx_++) {{
        vec4 texel2 = texture2D(layerEmissiveMap[_idx_], v_Texcoord) * emissionIntensity;
        gl_FragColor.rgb += texel2.rgb;
    }}
#endif

}

@end