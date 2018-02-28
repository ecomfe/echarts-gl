// http://www.kode80.com/blog/2015/03/11/screen-space-reflections-in-unity-5/
// http://casual-effects.blogspot.jp/2014/08/screen-space-ray-tracing.html
@export ecgl.ssr.main

#define SHADER_NAME SSR
#define MAX_ITERATION 20;
#define SAMPLE_PER_FRAME 5;
#define TOTAL_SAMPLES 128;

uniform sampler2D sourceTexture;
uniform sampler2D gBufferTexture1;
uniform sampler2D gBufferTexture2;
uniform sampler2D gBufferTexture3;
uniform samplerCube specularCubemap;
uniform float specularIntensity: 1;

uniform mat4 projection;
uniform mat4 projectionInv;
uniform mat4 toViewSpace;
uniform mat4 toWorldSpace;

uniform float maxRayDistance: 200;

uniform float pixelStride: 16;
uniform float pixelStrideZCutoff: 50; // ray origin Z at this distance will have a pixel stride of 1.0

uniform float screenEdgeFadeStart: 0.9; // distance to screen edge that ray hits will start to fade (0.0 -> 1.0)

uniform float eyeFadeStart : 0.2; // ray direction's Z that ray hits will start to fade (0.0 -> 1.0)
uniform float eyeFadeEnd: 0.8; // ray direction's Z that ray hits will be cut (0.0 -> 1.0)

uniform float minGlossiness: 0.2; // Object larger than minGlossiness will have ssr effect
uniform float zThicknessThreshold: 1;

uniform float nearZ;
uniform vec2 viewportSize : VIEWPORT_SIZE;

uniform float jitterOffset: 0;

varying vec2 v_Texcoord;

#ifdef DEPTH_DECODE
@import clay.util.decode_float
#endif

#ifdef PHYSICALLY_CORRECT
// uniform vec3 lambertNormals[SAMPLE_PER_FRAME];
uniform sampler2D normalDistribution;
uniform float sampleOffset: 0;
uniform vec2 normalDistributionSize;

vec3 transformNormal(vec3 H, vec3 N) {
    vec3 upVector = N.y > 0.999 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 tangentX = normalize(cross(N, upVector));
    vec3 tangentZ = cross(N, tangentX);
    // Tangent to world space
    return normalize(tangentX * H.x + N * H.y + tangentZ * H.z);
}
vec3 importanceSampleNormalGGX(float i, float roughness, vec3 N) {
    float p = fract((i + sampleOffset) / float(TOTAL_SAMPLES));
    vec3 H = texture2D(normalDistribution,vec2(roughness, p)).rgb;
    return transformNormal(H, N);
}
float G_Smith(float g, float ndv, float ndl) {
    float roughness = 1.0 - g;
    float k = roughness * roughness / 2.0;
    float G1V = ndv / (ndv * (1.0 - k) + k);
    float G1L = ndl / (ndl * (1.0 - k) + k);
    return G1L * G1V;
}
vec3 F_Schlick(float ndv, vec3 spec) {
    return spec + (1.0 - spec) * pow(1.0 - ndv, 5.0);
}
#endif

float fetchDepth(sampler2D depthTexture, vec2 uv)
{
    vec4 depthTexel = texture2D(depthTexture, uv);
    return depthTexel.r * 2.0 - 1.0;
}

float linearDepth(float depth)
{
    if (projection[3][3] == 0.0) {
        // Perspective
        return projection[3][2] / (depth * projection[2][3] - projection[2][2]);
    }
    else {
        // Symmetrical orthographic
        // PENDING
        return (depth - projection[3][2]) / projection[2][2];
    }
}

bool rayIntersectDepth(float rayZNear, float rayZFar, vec2 hitPixel)
{
    // Swap if bigger
    if (rayZFar > rayZNear)
    {
        float t = rayZFar; rayZFar = rayZNear; rayZNear = t;
    }
    float cameraZ = linearDepth(fetchDepth(gBufferTexture2, hitPixel));
    // Cross z
    return rayZFar <= cameraZ && rayZNear >= cameraZ - zThicknessThreshold;
}

// Trace a ray in screenspace from rayOrigin (in camera space) pointing in rayDir (in camera space)
//
// With perspective correct interpolation
//
// Returns true if the ray hits a pixel in the depth buffer
// and outputs the hitPixel (in UV space), the hitPoint (in camera space) and the number
// of iterations it took to get there.
//
// Based on Morgan McGuire & Mike Mara's GLSL implementation:
// http://casual-effects.blogspot.com/2014/08/screen-space-ray-tracing.html

bool traceScreenSpaceRay(
    vec3 rayOrigin, vec3 rayDir, float jitter,
    out vec2 hitPixel, out vec3 hitPoint, out float iterationCount
)
{
    // Clip to the near plane
    float rayLength = ((rayOrigin.z + rayDir.z * maxRayDistance) > -nearZ)
        ? (-nearZ - rayOrigin.z) / rayDir.z : maxRayDistance;

    vec3 rayEnd = rayOrigin + rayDir * rayLength;

    // Project into homogeneous clip space
    vec4 H0 = projection * vec4(rayOrigin, 1.0);
    vec4 H1 = projection * vec4(rayEnd, 1.0);

    float k0 = 1.0 / H0.w, k1 = 1.0 / H1.w;

    // The interpolated homogeneous version of the camera space points
    vec3 Q0 = rayOrigin * k0, Q1 = rayEnd * k1;

    // Screen space endpoints
    // PENDING viewportSize ?
    vec2 P0 = (H0.xy * k0 * 0.5 + 0.5) * viewportSize;
    vec2 P1 = (H1.xy * k1 * 0.5 + 0.5) * viewportSize;

    // If the line is degenerate, make it cover at least one pixel to avoid handling
    // zero-pixel extent as a special case later
    P1 += dot(P1 - P0, P1 - P0) < 0.0001 ? 0.01 : 0.0;
    vec2 delta = P1 - P0;

    // Permute so that the primary iteration is in x to collapse
    // all quadrant-specific DDA case later
    bool permute = false;
    if (abs(delta.x) < abs(delta.y)) {
        // More vertical line
        permute = true;
        delta = delta.yx;
        P0 = P0.yx;
        P1 = P1.yx;
    }
    float stepDir = sign(delta.x);
    float invdx = stepDir / delta.x;

    // Track the derivatives of Q and K
    vec3 dQ = (Q1 - Q0) * invdx;
    float dk = (k1 - k0) * invdx;

    vec2 dP = vec2(stepDir, delta.y * invdx);

    // Calculate pixel stride based on distance of ray origin from camera.
    // Since perspective means distant objects will be smaller in screen space
    // we can use this to have higher quality reflections for far away objects
    // while still using a large pixel stride for near objects (and increase performance)
    // this also helps mitigate artifacts on distant reflections when we use a large
    // pixel stride.
    float strideScaler = 1.0 - min(1.0, -rayOrigin.z / pixelStrideZCutoff);
    float pixStride = 1.0 + strideScaler * pixelStride;

    // Scale derivatives by the desired pixel stride and the offset the starting values by the jitter fraction
    dP *= pixStride; dQ *= pixStride; dk *= pixStride;

    // Track ray step and derivatives in a vec4 to parallelize
    vec4 pqk = vec4(P0, Q0.z, k0);
    vec4 dPQK = vec4(dP, dQ.z, dk);

    pqk += dPQK * jitter;
    float rayZFar = (dPQK.z * 0.5 + pqk.z) / (dPQK.w * 0.5 + pqk.w);
    float rayZNear;

    bool intersect = false;

    vec2 texelSize = 1.0 / viewportSize;

    iterationCount = 0.0;

    for (int i = 0; i < MAX_ITERATION; i++)
    {
        pqk += dPQK;

        rayZNear = rayZFar;
        rayZFar = (dPQK.z * 0.5 + pqk.z) / (dPQK.w * 0.5 + pqk.w);

        hitPixel = permute ? pqk.yx : pqk.xy;
        hitPixel *= texelSize;

        intersect = rayIntersectDepth(rayZNear, rayZFar, hitPixel);

        iterationCount += 1.0;

        dPQK *= 1.2;

        // PENDING Right on all platforms?
        if (intersect) {
            break;
        }
    }

    Q0.xy += dQ.xy * iterationCount;
    Q0.z = pqk.z;
    hitPoint = Q0 / pqk.w;

    return intersect;
}

float calculateAlpha(
    float iterationCount, float reflectivity,
    vec2 hitPixel, vec3 hitPoint, float dist, vec3 rayDir
)
{
    float alpha = clamp(reflectivity, 0.0, 1.0);
    // Fade ray hits that approach the maximum iterations
    alpha *= 1.0 - (iterationCount / float(MAX_ITERATION));
    // Fade ray hits that approach the screen edge
    vec2 hitPixelNDC = hitPixel * 2.0 - 1.0;
    float maxDimension = min(1.0, max(abs(hitPixelNDC.x), abs(hitPixelNDC.y)));
    alpha *= 1.0 - max(0.0, maxDimension - screenEdgeFadeStart) / (1.0 - screenEdgeFadeStart);

    // Fade ray hits base on how much they face the camera
    float _eyeFadeStart = eyeFadeStart;
    float _eyeFadeEnd = eyeFadeEnd;
    if (_eyeFadeStart > _eyeFadeEnd) {
        float tmp = _eyeFadeEnd;
        _eyeFadeEnd = _eyeFadeStart;
        _eyeFadeStart = tmp;
    }

    float eyeDir = clamp(rayDir.z, _eyeFadeStart, _eyeFadeEnd);
    alpha *= 1.0 - (eyeDir - _eyeFadeStart) / (_eyeFadeEnd - _eyeFadeStart);

    // Fade ray hits based on distance from ray origin
    alpha *= 1.0 - clamp(dist / maxRayDistance, 0.0, 1.0);

    return alpha;
}

@import clay.util.rand

@import clay.util.rgbm

void main()
{
    vec4 normalAndGloss = texture2D(gBufferTexture1, v_Texcoord);

    // Is empty
    if (dot(normalAndGloss.rgb, vec3(1.0)) == 0.0) {
        discard;
    }

    float g = normalAndGloss.a;
#if !defined(PHYSICALLY_CORRECT)
    if (g <= minGlossiness) {
        discard;
    }
#endif

    float reflectivity = (g - minGlossiness) / (1.0 - minGlossiness);

    vec3 N = normalize(normalAndGloss.rgb * 2.0 - 1.0);
    N = normalize((toViewSpace * vec4(N, 0.0)).xyz);

    // Position in view
    vec4 projectedPos = vec4(v_Texcoord * 2.0 - 1.0, fetchDepth(gBufferTexture2, v_Texcoord), 1.0);
    vec4 pos = projectionInv * projectedPos;
    vec3 rayOrigin = pos.xyz / pos.w;
    vec3 V = -normalize(rayOrigin);

    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float iterationCount;
    float jitter = rand(fract(v_Texcoord + jitterOffset));

#ifdef PHYSICALLY_CORRECT
    vec4 color = vec4(vec3(0.0), 1.0);
    vec4 albedoMetalness = texture2D(gBufferTexture3, v_Texcoord);
    vec3 albedo = albedoMetalness.rgb;
    float m = albedoMetalness.a;
    vec3 diffuseColor = albedo * (1.0 - m);
    vec3 spec = mix(vec3(0.04), albedo, m);

    // PENDING Add noise?
    float jitter2 = rand(fract(v_Texcoord)) * float(TOTAL_SAMPLES);

    for (int i = 0; i < SAMPLE_PER_FRAME; i++) {
        vec3 H = importanceSampleNormalGGX(float(i) + jitter2, 1.0 - g, N);
        // TODO Normal
        // vec3 H = transformNormal(lambertNormals[i], N);
        // vec3 rayDir = H;
        vec3 rayDir = normalize(reflect(-V, H));
#else
        vec3 rayDir = normalize(reflect(-V, N));
#endif
        vec2 hitPixel;
        vec3 hitPoint;

        bool intersect = traceScreenSpaceRay(rayOrigin, rayDir, jitter, hitPixel, hitPoint, iterationCount);

        float dist = distance(rayOrigin, hitPoint);

        vec3 hitNormal = texture2D(gBufferTexture1, hitPixel).rgb * 2.0 - 1.0;
        hitNormal = normalize((toViewSpace * vec4(hitNormal, 0.0)).xyz);
#ifdef PHYSICALLY_CORRECT
        float ndl = clamp(dot(N, rayDir), 0.0, 1.0);
        float vdh = clamp(dot(V, H), 0.0, 1.0);
        float ndh = clamp(dot(N, H), 0.0, 1.0);
        vec3 litTexel = vec3(0.0);
        if (dot(hitNormal, rayDir) < 0.0 && intersect) {
            litTexel = texture2D(sourceTexture, hitPixel).rgb;
            // PENDING
            litTexel *= pow(clamp(1.0 - dist / 200.0, 0.0, 1.0), 3.0);

            // color.rgb += ndl * litTexel * fade * diffuseColor;
        }
        else {
            // Fetch from environment
#ifdef SPECULARCUBEMAP_ENABLED
            vec3 rayDirW = normalize(toWorldSpace * vec4(rayDir, 0.0)).rgb;
            litTexel = RGBMDecode(textureCubeLodEXT(specularCubemap, rayDirW, 0.0), 8.12).rgb * specularIntensity;
#endif
        }
        color.rgb += ndl * litTexel * (
                F_Schlick(ndl, spec) * G_Smith(g, ndv, ndl) * vdh / (ndh * ndv + 0.001)
            );
    }
    color.rgb /= float(SAMPLE_PER_FRAME);
#else
    // Ignore the pixel not face the ray
    // TODO fadeout ?
    // PENDING Can be configured?
#if !defined(SPECULARCUBEMAP_ENABLED)
    if (dot(hitNormal, rayDir) >= 0.0) {
        discard;
    }
    if (!intersect) {
        discard;
    }
#endif
    float alpha = clamp(calculateAlpha(iterationCount, reflectivity, hitPixel, hitPoint, dist, rayDir), 0.0, 1.0);
    vec4 color = texture2D(sourceTexture, hitPixel);
    color.rgb *= alpha;

#ifdef SPECULARCUBEMAP_ENABLED
    vec3 rayDirW = normalize(toWorldSpace * vec4(rayDir, 0.0)).rgb;
    alpha = alpha * (intersect ? 1.0 : 0.0);
    float bias = (1.0 -g) * 5.0;
    color.rgb += (1.0 - alpha)
        * RGBMDecode(textureCubeLodEXT(specularCubemap, rayDirW, bias), 8.12).rgb
        * specularIntensity;
#endif

#endif

    gl_FragColor = encodeHDR(color);
}
@end

// https://bartwronski.com/2014/03/23/gdc-follow-up-screenspace-reflections-filtering-and-up-sampling/
@export ecgl.ssr.blur

uniform sampler2D texture;
uniform sampler2D gBufferTexture1;
uniform sampler2D gBufferTexture2;
uniform mat4 projection;
uniform float depthRange : 0.05;

varying vec2 v_Texcoord;

uniform vec2 textureSize;
uniform float blurSize : 1.0;

#ifdef BLEND
    #ifdef SSAOTEX_ENABLED
uniform sampler2D ssaoTex;
    #endif
uniform sampler2D sourceTexture;
#endif

float getLinearDepth(vec2 coord)
{
    float depth = texture2D(gBufferTexture2, coord).r * 2.0 - 1.0;
    return projection[3][2] / (depth * projection[2][3] - projection[2][2]);
}

@import clay.util.rgbm


void main()
{
    @import clay.compositor.kernel.gaussian_9

    vec4 centerNTexel = texture2D(gBufferTexture1, v_Texcoord);
    float g = centerNTexel.a;
    float maxBlurSize = clamp(1.0 - g, 0.0, 1.0) * blurSize;
#ifdef VERTICAL
    vec2 off = vec2(0.0, maxBlurSize / textureSize.y);
#else
    vec2 off = vec2(maxBlurSize / textureSize.x, 0.0);
#endif

    vec2 coord = v_Texcoord;

    vec4 sum = vec4(0.0);
    float weightAll = 0.0;

    vec3 cN = centerNTexel.rgb * 2.0 - 1.0;
    float cD = getLinearDepth(v_Texcoord);
    for (int i = 0; i < 9; i++) {
        vec2 coord = clamp((float(i) - 4.0) * off + v_Texcoord, vec2(0.0), vec2(1.0));
        float w = gaussianKernel[i]
            * clamp(dot(cN, texture2D(gBufferTexture1, coord).rgb * 2.0 - 1.0), 0.0, 1.0);
        float d = getLinearDepth(coord);
        w *= (1.0 - smoothstep(abs(cD - d) / depthRange, 0.0, 1.0));

        weightAll += w;
        sum += decodeHDR(texture2D(texture, coord)) * w;
    }

#ifdef BLEND
    float aoFactor = 1.0;
    #ifdef SSAOTEX_ENABLED
    aoFactor = texture2D(ssaoTex, v_Texcoord).r;
    #endif
    gl_FragColor = encodeHDR(
        sum / weightAll * aoFactor + decodeHDR(texture2D(sourceTexture, v_Texcoord))
    );
#else
    gl_FragColor = encodeHDR(sum / weightAll);
#endif
}

@end