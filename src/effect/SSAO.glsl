@export ecgl.ssao.estimate

uniform sampler2D depthTex;

uniform sampler2D normalTex;

uniform sampler2D noiseTex;

uniform vec2 depthTexSize;

uniform vec2 noiseTexSize;

uniform mat4 projection;

uniform mat4 projectionInv;

uniform mat4 viewInverseTranspose;

uniform vec3 kernel[KERNEL_SIZE];

uniform float radius : 1;

// PENDING
uniform float power : 1;

uniform float bias: 1e-2;

uniform float intensity: 1.0;

varying vec2 v_Texcoord;

float ssaoEstimator(in vec3 originPos, in mat3 kernelBasis) {
    float occlusion = 0.0;

    for (int i = 0; i < KERNEL_SIZE; i++) {
        vec3 samplePos = kernel[i];
#ifdef NORMALTEX_ENABLED
        samplePos = kernelBasis * samplePos;
#endif
        samplePos = samplePos * radius + originPos;

        vec4 texCoord = projection * vec4(samplePos, 1.0);
        texCoord.xy /= texCoord.w;

        vec4 depthTexel = texture2D(depthTex, texCoord.xy * 0.5 + 0.5);

        float sampleDepth = depthTexel.r * 2.0 - 1.0;
        if (projection[3][3] == 0.0) {
            // Perspective
            sampleDepth = projection[3][2] / (sampleDepth * projection[2][3] - projection[2][2]);
        }
        else {
            // Symmetrical orthographic
            // PENDING
            sampleDepth = (sampleDepth - projection[3][2]) / projection[2][2];
        }
        // Consider orthographic projection
        // vec4 projectedPos = vec4(texCoord.xy, sampleDepth, 1.0);
        // vec4 p4 = projectionInv * projectedPos;
        // sampleDepth = p4.z / p4.w;

        float rangeCheck = smoothstep(0.0, 1.0, radius / abs(originPos.z - sampleDepth));
        occlusion += rangeCheck * step(samplePos.z, sampleDepth - bias);
    }
#ifdef NORMALTEX_ENABLED
    occlusion = 1.0 - occlusion / float(KERNEL_SIZE);
#else
    occlusion = 1.0 - clamp((occlusion / float(KERNEL_SIZE) - 0.6) * 2.5, 0.0, 1.0);
#endif
    return pow(occlusion, power);
}

void main()
{

    vec4 depthTexel = texture2D(depthTex, v_Texcoord);

#ifdef NORMALTEX_ENABLED
    vec4 tex = texture2D(normalTex, v_Texcoord);
    // Is empty
    if (dot(tex.rgb, tex.rgb) == 0.0) {
        gl_FragColor = vec4(1.0);
        return;
    }
    vec3 N = tex.rgb * 2.0 - 1.0;
    N = (viewInverseTranspose * vec4(N, 0.0)).xyz;

    vec2 noiseTexCoord = depthTexSize / vec2(noiseTexSize) * v_Texcoord;
    vec3 rvec = texture2D(noiseTex, noiseTexCoord).rgb * 2.0 - 1.0;
    // Tangent
    vec3 T = normalize(rvec - N * dot(rvec, N));
    // Bitangent
    vec3 BT = normalize(cross(N, T));
    mat3 kernelBasis = mat3(T, BT, N);
#else
    if (depthTexel.r > 0.99999) {
        gl_FragColor = vec4(1.0);
        return;
    }
    mat3 kernelBasis;
#endif

    float z = depthTexel.r * 2.0 - 1.0;

    vec4 projectedPos = vec4(v_Texcoord * 2.0 - 1.0, z, 1.0);
    vec4 p4 = projectionInv * projectedPos;

    vec3 position = p4.xyz / p4.w;

    float ao = ssaoEstimator(position, kernelBasis);
    ao = clamp(1.0 - (1.0 - ao) * intensity, 0.0, 1.0);
    gl_FragColor = vec4(vec3(ao), 1.0);
}

@end


@export ecgl.ssao.blur
#define SHADER_NAME SSAO_BLUR

uniform sampler2D ssaoTexture;

#ifdef NORMALTEX_ENABLED
uniform sampler2D normalTex;
#endif

varying vec2 v_Texcoord;

uniform vec2 textureSize;
uniform float blurSize : 1.0;

// 0 horizontal, 1 vertical
uniform int direction: 0.0;

#ifdef DEPTHTEX_ENABLED
uniform sampler2D depthTex;
uniform mat4 projection;
uniform float depthRange : 0.5;

float getLinearDepth(vec2 coord)
{
    float depth = texture2D(depthTex, coord).r * 2.0 - 1.0;
    return projection[3][2] / (depth * projection[2][3] - projection[2][2]);
}
#endif

void main()
{
    float kernel[5];
    kernel[0] = 0.122581;
    kernel[1] = 0.233062;
    kernel[2] = 0.288713;
    kernel[3] = 0.233062;
    kernel[4] = 0.122581;

    vec2 off = vec2(0.0);
    if (direction == 0) {
        off[0] = blurSize / textureSize.x;
    }
    else {
        off[1] = blurSize / textureSize.y;
    }

    vec2 coord = v_Texcoord;

    float sum = 0.0;
    float weightAll = 0.0;

#ifdef NORMALTEX_ENABLED
    vec3 centerNormal = texture2D(normalTex, v_Texcoord).rgb * 2.0 - 1.0;
#endif
#if defined(DEPTHTEX_ENABLED)
    float centerDepth = getLinearDepth(v_Texcoord);
#endif

    for (int i = 0; i < 5; i++) {
        vec2 coord = clamp(v_Texcoord + vec2(float(i) - 2.0) * off, vec2(0.0), vec2(1.0));

        float w = kernel[i];
#ifdef NORMALTEX_ENABLED
        vec3 normal = texture2D(normalTex, coord).rgb * 2.0 - 1.0;
        w *= clamp(dot(normal, centerNormal), 0.0, 1.0);
#endif
#ifdef DEPTHTEX_ENABLED
        float d = getLinearDepth(coord);
        // PENDING Better equation?
        w *= (1.0 - smoothstep(abs(centerDepth - d) / depthRange, 0.0, 1.0));
#endif

        weightAll += w;
        sum += texture2D(ssaoTexture, coord).r * w;
    }

   gl_FragColor = vec4(vec3(sum / weightAll), 1.0);
//    gl_FragColor = texture2D(ssaoTexture, v_Texcoord);
}

@end
