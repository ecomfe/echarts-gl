@export ecgl.trail.vertex

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;
uniform float percent : 0.0;
uniform float trailLength: 0.3;

uniform sampler2D pointsTexture;
uniform float textureWidth : 1024;

uniform vec4 viewport : VIEWPORT;
uniform float near : NEAR;

attribute vec2 uv;
attribute vec4 color : COLOR;

attribute float start;
attribute float prevT;
attribute float currT;
attribute float nextT;
attribute float offset;

varying vec4 v_Color;

@import ecgl.lines3D.clipNear

vec3 getPointAt(in float off, in vec3 p0, in vec3 p1, in vec3 p2, in vec3 p3) {
    float t = max(min(mod(start + percent, (1.0 + trailLength)) + off, 1.0), 0.0);
    float onet = 1.0 - t;
    return onet * onet * (onet * p0 + 3.0 * t * p1)
        + t * t * (t * p3 + 3.0 * onet * p2);
}

void main()
{
    vec2 unit = vec2(1.0 / textureWidth, 0.0);
    vec3 p0 = texture2D(pointsTexture, uv).rgb;
    vec3 p1 = texture2D(pointsTexture, uv + unit).rgb;
    vec3 p2 = texture2D(pointsTexture, uv + unit * 2.0).rgb;
    vec3 p3 = texture2D(pointsTexture, uv + unit * 3.0).rgb;

    vec3 positionPrev = getPointAt(prevT, p0, p1, p2, p3);
    vec3 position = getPointAt(currT, p0, p1, p2, p3);
    vec3 positionNext = getPointAt(nextT, p0, p1, p2, p3);

    @import ecgl.lines3D.expandLine

    gl_Position = currProj;

    v_Color = color;
}

@end

@export ecgl.trail.fragment

varying vec4 v_Color;

uniform sampler2D sprite;

void main()
{
    gl_FragColor = v_Color;

#ifdef SPRITE_ENABLED
    gl_FragColor *= texture2D(sprite, gl_PointCoord);
#endif

}
@end