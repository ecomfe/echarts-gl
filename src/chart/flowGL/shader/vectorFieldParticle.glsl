@export ecgl.vfParticle.particle.fragment

uniform sampler2D particleTexture;
uniform sampler2D spawnTexture;
uniform sampler2D velocityTexture;

uniform float deltaTime;
uniform float elapsedTime;

uniform float speedScaling : 1.0;

varying vec2 v_Texcoord;

void main()
{
    vec4 p = texture2D(particleTexture, v_Texcoord);
    if (p.w > 0.0) {
        vec4 vTex = texture2D(velocityTexture, p.xy);
        vec2 v = vTex.xy;
        v = (v - 0.5) * 2.0;
        p.z = length(v);
        p.xy += v * deltaTime / 50.0 * speedScaling;
        // Make the particle surface seamless
        p.xy = fract(p.xy);
        p.w -= deltaTime;
    }
    else {
        p = texture2D(spawnTexture, fract(v_Texcoord + elapsedTime / 10.0));
        p.z = 0.0;
    }
    gl_FragColor = p;
}
@end

@export ecgl.vfParticle.renderPoints.vertex

#define PI 3.1415926

attribute vec2 texcoord : TEXCOORD_0;

uniform sampler2D particleTexture;
uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;

uniform float sizeScaling : 1.0;

void main()
{
    vec4 p = texture2D(particleTexture, texcoord);

    if (p.w > 0.0) {
        gl_Position = worldViewProjection * vec4(p.xy * 2.0 - 1.0, 0.0, 1.0);
    }
    else {
        gl_Position = vec4(100000.0, 100000.0, 100000.0, 1.0);
    }

    gl_PointSize = sizeScaling * p.z;
}

@end

@export ecgl.vfParticle.renderPoints.fragment

uniform sampler2D spriteTexture;
uniform vec4 color : [1.0, 1.0, 1.0, 1.0];

void main()
{
    gl_FragColor = color * texture2D(spriteTexture, gl_PointCoord);
}

@end
