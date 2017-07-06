// COMMON SHADERS

// ----------------- UNIFORM AND ATTRIBUTES -----------
@export ecgl.common.transformUniforms
uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;
uniform mat4 worldInverseTranspose : WORLDINVERSETRANSPOSE;
uniform mat4 world : WORLD;
@end

@export ecgl.common.attributes
attribute vec3 position : POSITION;
attribute vec2 texcoord : TEXCOORD_0;
attribute vec3 normal : NORMAL;
@end

@export ecgl.common.uv.header
uniform vec2 uvRepeat : [1.0, 1.0];
uniform vec2 uvOffset : [0.0, 0.0];
uniform vec2 detailUvRepeat : [1.0, 1.0];
uniform vec2 detailUvOffset : [0.0, 0.0];

varying vec2 v_Texcoord;
varying vec2 v_DetailTexcoord;
@end

@export ecgl.common.uv.main
v_Texcoord = texcoord * uvRepeat + uvOffset;
v_DetailTexcoord = texcoord * detailUvRepeat + detailUvOffset;
@end

@export ecgl.common.uv.fragmentHeader
varying vec2 v_Texcoord;
varying vec2 v_DetailTexcoord;
@end

// ----------------- albedo -----------

@export ecgl.common.albedo.main

    vec4 albedoTexel = vec4(1.0);
#ifdef DIFFUSEMAP_ENABLED
    albedoTexel = texture2D(diffuseMap, v_Texcoord);
    #ifdef SRGB_DECODE
    albedoTexel = sRGBToLinear(albedoTexel);
    #endif
#endif

#ifdef DETAILMAP_ENABLED
    vec4 detailTexel = texture2D(detailMap, v_DetailTexcoord);
    #ifdef SRGB_DECODE
    detailTexel = sRGBToLinear(detailTexel);
    #endif
    albedoTexel.rgb = mix(albedoTexel.rgb, detailTexel.rgb, detailTexel.a);
    albedoTexel.a = detailTexel.a + (1.0 - detailTexel.a) * albedoTexel.a;
#endif

@end

// -----------------WIREFRAME -----------
@export ecgl.common.wireframe.vertexHeader

#ifdef WIREFRAME_QUAD
attribute vec4 barycentric;
varying vec4 v_Barycentric;
#elif defined(WIREFRAME_TRIANGLE)
attribute vec3 barycentric;
varying vec3 v_Barycentric;
#endif

@end

@export ecgl.common.wireframe.vertexMain

#if defined(WIREFRAME_QUAD) || defined(WIREFRAME_TRIANGLE)
    v_Barycentric = barycentric;
#endif

@end


@export ecgl.common.wireframe.fragmentHeader

uniform float wireframeLineWidth : 1;
uniform vec4 wireframeLineColor: [0, 0, 0, 0.5];

#ifdef WIREFRAME_QUAD
varying vec4 v_Barycentric;
float edgeFactor () {
    vec4 d = fwidth(v_Barycentric);
    vec4 a4 = smoothstep(vec4(0.0), d * wireframeLineWidth, v_Barycentric);
    return min(min(min(a4.x, a4.y), a4.z), a4.w);
}
#elif defined(WIREFRAME_TRIANGLE)
varying vec3 v_Barycentric;
float edgeFactor () {
    vec3 d = fwidth(v_Barycentric);
    vec3 a3 = smoothstep(vec3(0.0), d * wireframeLineWidth, v_Barycentric);
    return min(min(a3.x, a3.y), a3.z);
}
#endif

@end


@export ecgl.common.wireframe.fragmentMain

#if defined(WIREFRAME_QUAD) || defined(WIREFRAME_TRIANGLE)
    if (wireframeLineWidth > 0.) {
        vec4 lineColor = wireframeLineColor;
#ifdef SRGB_DECODE
        lineColor = sRGBToLinear(lineColor);
#endif

        gl_FragColor.rgb = mix(gl_FragColor.rgb, lineColor.rgb, (1.0 - edgeFactor()) * lineColor.a);
    }
#endif
@end



// ----------------- Bumpmap and normal map -----------

@export ecgl.common.bumpMap.header

#ifdef BUMPMAP_ENABLED
uniform sampler2D bumpMap;
uniform float bumpScale : 1.0;
// Derivative maps - bump mapping unparametrized surfaces by Morten Mikkelsen
//  http://mmikkelsen3d.blogspot.sk/2011/07/derivative-maps.html

// Evaluate the derivative of the height w.r.t. screen-space using forward differencing (listing 2)

vec3 bumpNormal(vec3 surfPos, vec3 surfNormal, vec3 baseNormal)
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

@end

@export ecgl.common.normalMap.vertexHeader

#ifdef NORMALMAP_ENABLED
attribute vec4 tangent : TANGENT;
varying vec3 v_Tangent;
varying vec3 v_Bitangent;
#endif

@end

@export ecgl.common.normalMap.vertexMain

#ifdef NORMALMAP_ENABLED
    if (dot(tangent, tangent) > 0.0) {
        v_Tangent = normalize((worldInverseTranspose * vec4(tangent.xyz, 0.0)).xyz);
        v_Bitangent = normalize(cross(v_Normal, v_Tangent) * tangent.w);
    }
#endif

@end


@export ecgl.common.normalMap.fragmentHeader

#ifdef NORMALMAP_ENABLED
uniform sampler2D normalMap;
varying vec3 v_Tangent;
varying vec3 v_Bitangent;
#endif

@end

@export ecgl.common.normalMap.fragmentMain
#ifdef NORMALMAP_ENABLED
    if (dot(v_Tangent, v_Tangent) > 0.0) {
        vec3 normalTexel = texture2D(normalMap, v_DetailTexcoord).xyz;
        if (dot(normalTexel, normalTexel) > 0.0) { // Valid normal map
            N = normalTexel * 2.0 - 1.0;
            mat3 tbn = mat3(v_Tangent, v_Bitangent, v_Normal);
            N = normalize(tbn * N);
        }
    }
#endif
@end


//----------- Vertex animation ---------

@export ecgl.common.vertexAnimation.header

#ifdef VERTEX_ANIMATION
attribute vec3 prevPosition;
attribute vec3 prevNormal;
uniform float percent;
#endif

@end

@export ecgl.common.vertexAnimation.main

#ifdef VERTEX_ANIMATION
    vec3 pos = mix(prevPosition, position, percent);
    vec3 norm = mix(prevNormal, normal, percent);
#else
    vec3 pos = position;
    vec3 norm = normal;
#endif

@end

//---------- SSAO MAP -------

@export ecgl.common.ssaoMap.header
#ifdef SSAOMAP_ENABLED
uniform sampler2D ssaoMap;
uniform vec4 viewport : VIEWPORT;
#endif
@end

@export ecgl.common.ssaoMap.main
    float ao = 1.0;
#ifdef SSAOMAP_ENABLED
    ao = texture2D(ssaoMap, (gl_FragCoord.xy - viewport.xy) / viewport.zw).r;
#endif
@end


//----------- Layers ---------


@export ecgl.common.diffuseLayer.header

#if (LAYER_DIFFUSEMAP_COUNT > 0)
uniform float layerDiffuseIntensity[LAYER_DIFFUSEMAP_COUNT];
uniform sampler2D layerDiffuseMap[LAYER_DIFFUSEMAP_COUNT];
#endif

@end

@export ecgl.common.emissiveLayer.header

#if (LAYER_EMISSIVEMAP_COUNT > 0)
uniform float layerEmissionIntensity[LAYER_EMISSIVEMAP_COUNT];
uniform sampler2D layerEmissiveMap[LAYER_EMISSIVEMAP_COUNT];
#endif

@end

@export ecgl.common.layers.header
@import ecgl.common.diffuseLayer.header
@import ecgl.common.emissiveLayer.header
@end

@export ecgl.common.diffuseLayer.main

#if (LAYER_DIFFUSEMAP_COUNT > 0)
    for (int _idx_ = 0; _idx_ < LAYER_DIFFUSEMAP_COUNT; _idx_++) {{
        float intensity = layerDiffuseIntensity[_idx_];
        vec4 texel2 = texture2D(layerDiffuseMap[_idx_], v_Texcoord);
        #ifdef SRGB_DECODE
        texel2 = sRGBToLinear(texel2);
        #endif
        // source-over blend
        albedoTexel.rgb = mix(albedoTexel.rgb, texel2.rgb * intensity, texel2.a);
        albedoTexel.a = texel2.a + (1.0 - texel2.a) * albedoTexel.a;
    }}
#endif

@end

@export ecgl.common.emissiveLayer.main

#if (LAYER_EMISSIVEMAP_COUNT > 0)
    for (int _idx_ = 0; _idx_ < LAYER_EMISSIVEMAP_COUNT; _idx_++)
    {{
        vec4 texel2 = texture2D(layerEmissiveMap[_idx_], v_Texcoord) * layerEmissionIntensity[_idx_];
        #ifdef SRGB_DECODE
        texel2 = sRGBToLinear(texel2);
        #endif
        float intensity = layerEmissionIntensity[_idx_];
        gl_FragColor.rgb += texel2.rgb * texel2.a * intensity;
    }}
#endif

@end
