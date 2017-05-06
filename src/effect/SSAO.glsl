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

        sampleDepth = projection[3][2] / (sampleDepth * projection[2][3] - projection[2][2]);

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
    if (tex.a == 0.0) {
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

uniform sampler2D ssaoTexture;
uniform sampler2D sourceTexture;

uniform vec2 textureSize;

varying vec2 v_Texcoord;

void main ()
{

    vec2 texelSize = 1.0 / textureSize;

    float ao = float(0.0);
    vec2 hlim = vec2(float(-BLUR_SIZE) * 0.5 + 0.5);
    float centerAo = texture2D(ssaoTexture, v_Texcoord).r;
    float weightAll = 0.0;
    float boxWeight = 1.0 / float(BLUR_SIZE) * float(BLUR_SIZE);
    for (int x = 0; x < BLUR_SIZE; x++) {
        for (int y = 0; y < BLUR_SIZE; y++) {
            vec2 coord = (vec2(float(x), float(y)) + hlim) * texelSize + v_Texcoord;
            float sampleAo = texture2D(ssaoTexture, coord).r;
            // http://stackoverflow.com/questions/6538310/anyone-know-where-i-can-find-a-glsl-implementation-of-a-bilateral-filter-blur
            // PENDING
            float closeness = 1.0 - distance(sampleAo, centerAo) / sqrt(3.0);
            float weight = boxWeight * closeness;
            ao += weight * sampleAo;
            weightAll += weight;
        }
    }

    vec4 color = texture2D(sourceTexture, v_Texcoord);
    color.rgb *= clamp(ao / weightAll, 0.0, 1.0);
    gl_FragColor = color;
}
@end