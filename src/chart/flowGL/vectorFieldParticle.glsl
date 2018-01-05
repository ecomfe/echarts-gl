@export ecgl.vfParticle.particle.fragment

uniform sampler2D particleTexture;
uniform sampler2D spawnTexture;
uniform sampler2D velocityTexture;

uniform float deltaTime;
uniform float elapsedTime;

uniform float speedScaling : 1.0;

uniform vec2 textureSize;
uniform vec4 region : [0, 0, 1, 1];
uniform float firstFrameTime;

varying vec2 v_Texcoord;

// vec2 bilinearFetch(vec2 uv)
// {
//     vec2 off = 1.0 / textureSize;
//     vec2 sc = (floor(uv * textureSize)) * off;
//     vec2 f = fract(uv * textureSize);
//     vec2 tl = texture2D(velocityTexture, sc).xy;
//     vec2 tr = texture2D(velocityTexture, sc + vec2(off.x, 0)).xy;
//     vec2 bl = texture2D(velocityTexture, sc + vec2(0, off.y)).xy;
//     vec2 br = texture2D(velocityTexture, sc + off).xy;
//     return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
// }

void main()
{
    vec4 p = texture2D(particleTexture, v_Texcoord);
    bool spawn = false;
    if (p.w <= 0.0) {
        p = texture2D(spawnTexture, fract(v_Texcoord + elapsedTime / 10.0));
        p.w -= firstFrameTime;
        spawn = true;
    }
    vec2 v = texture2D(velocityTexture, fract(p.xy * region.zw + region.xy)).xy;
    // https://blog.mapbox.com/how-i-built-a-wind-map-with-webgl-b63022b5537f
    // vec2 v = bilinearFetch(fract(p.xy * region.zw + region.xy));
    v = (v - 0.5) * 2.0;
    p.z = length(v);
    p.xy += v * deltaTime / 10.0 * speedScaling;
    p.w -= deltaTime;

    // TODO Not show just spawned particle or crossed particle.
    if (spawn || p.xy != fract(p.xy)) {
        p.z = 0.0;
    }
    // Make the particle surface seamless
    p.xy = fract(p.xy);

    gl_FragColor = p;
}
@end

@export ecgl.vfParticle.renderPoints.vertex

#define PI 3.1415926

attribute vec2 texcoord : TEXCOORD_0;

uniform sampler2D particleTexture;
uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;

uniform float size : 1.0;

varying float v_Mag;
varying vec2 v_Uv;

void main()
{
    vec4 p = texture2D(particleTexture, texcoord);

    // PENDING If ignore 0 length vector
    if (p.w > 0.0 && p.z > 1e-5) {
        gl_Position = worldViewProjection * vec4(p.xy * 2.0 - 1.0, 0.0, 1.0);
    }
    else {
        gl_Position = vec4(100000.0, 100000.0, 100000.0, 1.0);
    }

    v_Mag = p.z;
    v_Uv = p.xy;

    gl_PointSize = size;
}

@end

@export ecgl.vfParticle.renderPoints.fragment

uniform vec4 color : [1.0, 1.0, 1.0, 1.0];
uniform sampler2D gradientTexture;
uniform sampler2D colorTexture;
uniform sampler2D spriteTexture;

varying float v_Mag;
varying vec2 v_Uv;

void main()
{
    gl_FragColor = color;
#ifdef SPRITETEXTURE_ENABLED
    gl_FragColor *= texture2D(spriteTexture, gl_PointCoord);
    if (color.a == 0.0) {
        discard;
    }
#endif
#ifdef GRADIENTTEXTURE_ENABLED
    gl_FragColor *= texture2D(gradientTexture, vec2(v_Mag, 0.5));
#endif
#ifdef COLORTEXTURE_ENABLED
    gl_FragColor *= texture2D(colorTexture, v_Uv);
#endif
}

@end

@export ecgl.vfParticle.renderLines.vertex

#define PI 3.1415926

attribute vec3 position : POSITION;

uniform sampler2D particleTexture;
uniform sampler2D prevParticleTexture;

uniform float size : 1.0;
uniform vec4 vp: VIEWPORT;
uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;

varying float v_Mag;
varying vec2 v_Uv;

@import clay.util.rand

void main()
{
    vec4 p = texture2D(particleTexture, position.xy);
    vec4 p2 = texture2D(prevParticleTexture, position.xy);

    p.xy = p.xy * 2.0 - 1.0;
    p2.xy = p2.xy * 2.0 - 1.0;

    // PENDING If ignore 0 length vector
    if (p.w > 0.0 && p.z > 1e-5) {
        vec2 dir = normalize(p.xy - p2.xy);
        vec2 norm = vec2(dir.y / vp.z, -dir.x / vp.w) * sign(position.z) * size;
        if (abs(position.z) == 2.0) {
            gl_Position = vec4(p.xy + norm, 0.0, 1.0);
            v_Uv = p.xy;
            v_Mag = p.z;
        }
        else {
            gl_Position = vec4(p2.xy + norm, 0.0, 1.0);
            v_Mag = p2.z;
            v_Uv = p2.xy;
        }
        gl_Position = worldViewProjection * gl_Position;
    }
    else {
        gl_Position = vec4(100000.0, 100000.0, 100000.0, 1.0);
    }
}

@end

@export ecgl.vfParticle.renderLines.fragment

uniform vec4 color : [1.0, 1.0, 1.0, 1.0];
uniform sampler2D gradientTexture;
uniform sampler2D colorTexture;

varying float v_Mag;
varying vec2 v_Uv;

void main()
{
    gl_FragColor = color;
    // gl_FragColor = mix(vec4(1.0,0.0,0.0,1.0), vec4(0.0,0.0,1.0,1.0), 1.0 - v_Mag);
#ifdef GRADIENTTEXTURE_ENABLED
    gl_FragColor *= texture2D(gradientTexture, vec2(v_Mag, 0.5));
#endif
#ifdef COLORTEXTURE_ENABLED
    gl_FragColor *= texture2D(colorTexture, v_Uv);
#endif
}

@end
